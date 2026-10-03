import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { MemoryFs, setFs } from '../fs'
import { setCollabBinding, useProjectStore } from '../state'
import { invalidate, readTop } from './bridge'
import { CollabNetwork } from './network'
import { decodeServerCode, deviceIdForKey, encodeServerCode, isServerCode, newSecret, type Invite, type ServerCode } from './protocol'
import { ServerTransport } from './serverTransport'
import { CollabSession } from './session'

describe('server connect codes', () => {
  const code: ServerCode = {
    url: 'wss://games.example.com/sync',
    fingerprint: null,
    serverProjectId: 'p1',
    projectName: 'Space Game',
    serverName: 'Studio',
    key: 'egd-key-test',
  }

  it('round-trips and rejects anything else', () => {
    const text = encodeServerCode(code)
    expect(isServerCode(text)).toBe(true)
    expect(decodeServerCode(` ${text} `)).toEqual(code)
    expect(decodeServerCode('EGD1-abc')).toBeNull()
    expect(decodeServerCode('EGS1-notbase64!')).toBeNull()
    expect(decodeServerCode(encodeServerCode({ ...code, url: 'http://x' }))).toBeNull()
    expect(decodeServerCode(encodeServerCode({ ...code, fingerprint: 'nothex' }))).toBeNull()
  })

  it('computes the same device id as the server', async () => {
    expect(await deviceIdForKey('egd-key-test')).toBe('k-e306e0f80d917ef3b0fe4d960b7dcaab')
  })
})

/**
 * Against the real server: set EGD_SERVER_BIN to its binary
 * (Evelopment-Games-Designer-Server/server/target/debug/egd-server).
 */
// The app has no Node types (it runs in a webview), so the few Node calls here are typed by hand.
type NodeProcess = { env: Record<string, string | undefined> }
interface Child {
  kill(): void
}
const nodeModule = (name: string) => import(/* @vite-ignore */ name) as Promise<Record<string, (...args: unknown[]) => unknown>>
const bin = (globalThis as { process?: NodeProcess }).process?.env.EGD_SERVER_BIN
describe.skipIf(!bin)('working through a server', () => {
  let data = ''
  const port = 19474 + Math.floor(Math.random() * 400)
  let server: Child
  let cookie = ''
  let csrf = ''
  const codes: Record<string, ServerCode> = {}

  async function api(method: string, path: string, body?: unknown) {
    const res = await fetch(`http://127.0.0.1:${port + 1000}/admin/api/${path}`, {
      method,
      headers: { cookie, 'x-csrf': csrf, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const out = (await res.json()) as Record<string, string>
    if (out.csrf) csrf = out.csrf
    return out
  }

  beforeAll(async () => {
    const [fs, os, path, cp] = await Promise.all(['node:fs', 'node:os', 'node:path', 'node:child_process'].map(nodeModule))
    data = fs.mkdtempSync(path.join(os.tmpdir(), 'egd-app-server-')) as string
    const env = (globalThis as unknown as { process: NodeProcess }).process.env
    server = cp.spawn(bin, ['--data', data, '--no-browser', '--headless'], {
      env: { ...env, EGD_SYNC_ADDR: `127.0.0.1:${port}`, EGD_ADMIN_ADDR: `127.0.0.1:${port + 1000}` },
      stdio: 'ignore',
    }) as Child
    for (let i = 0; i < 100; i++) {
      if (await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.ok, () => false)) break
      await new Promise((r) => setTimeout(r, 100))
    }
    await api('POST', 'setup', { serverName: 'Studio', password: 'blue horse staple 42', mode: 'proxy' })
    const { id } = await api('POST', 'projects', { name: 'Game' })
    for (const [label, role] of [['ana', 'write'], ['ben', 'write'], ['guest', 'view']]) {
      codes[label] = decodeServerCode((await api('POST', `projects/${id}/keys`, { label, role })).code)!
    }
  }, 20_000)

  afterAll(async () => {
    setCollabBinding(null)
    await useProjectStore.getState().close()
    server?.kill()
    await new Promise((r) => setTimeout(r, 300))
    const fs = await nodeModule('node:fs')
    fs.rmSync(data, { recursive: true, force: true })
  })

  async function until(check: () => boolean, what: string, ms = 5000) {
    const end = Date.now() + ms
    while (!check()) {
      if (Date.now() > end) throw new Error(`timed out: ${what}`)
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  function joiner(code: ServerCode) {
    const doc = new Y.Doc()
    doc.on('afterTransaction', invalidate)
    const invite: Invite = { projectId: '', projectName: code.projectName, address: code.url, secret: '' }
    const state = { synced: false }
    const transport = new ServerTransport(code, { authenticated: (w) => (invite.projectId = w.projectId ?? '') })
    const net = new CollabNetwork(transport, doc, { kind: 'join', invite }, { name: 'Joiner', color: '#000' }, { synced: () => (state.synced = true) })
    return { doc, net, state, transport }
  }

  it('uploads a project, and someone joins it later while the uploader is offline', async () => {
    setFs(new MemoryFs())
    await useProjectStore.getState().create({ name: 'Game', description: '', components: ['item-list'] })
    useProjectStore.getState().addEntity('item', 'Sword')
    const { root, meta, entities, categories } = useProjectStore.getState()
    const session = await CollabSession.create(root!, { meta: meta!, entities, categories }, { projectId: meta!.id, secret: newSecret() }, null)
    setCollabBinding(session)
    const upload = new ServerTransport(codes.ana)
    let synced = false
    const ana = new CollabNetwork(
      upload,
      session.doc,
      { kind: 'member', session, onJoinRequest: async () => false, server: codes.ana.url },
      { name: 'Ana', color: '#f00' },
      { synced: () => (synced = true) },
    )
    await ana.start()
    await until(() => synced, 'ana synced with the server')
    expect(upload.welcome?.empty).toBe(true)
    expect(upload.welcome?.role).toBe('write')
    await new Promise((r) => setTimeout(r, 300))
    await ana.stop()

    const ben = joiner(codes.ben)
    await ben.net.start()
    await until(() => ben.state.synced, 'ben synced')
    expect(ben.transport.welcome?.projectId).toBe(meta!.id)
    const items = readTop(ben.doc, 'entities:item') as { name: string }[]
    expect(items.map((i) => i.name)).toEqual(['Sword'])
    await ben.net.stop()
  }, 20_000)

  it('a view-only connection reads but never sends changes', async () => {
    const guest = joiner(codes.guest)
    await guest.net.start()
    await until(() => guest.state.synced, 'guest synced')
    guest.net.readOnly = guest.transport.welcome?.role === 'view'
    expect(guest.net.readOnly).toBe(true)
    guest.doc.getMap('meta').set('name', 'Vandalized')
    await new Promise((r) => setTimeout(r, 300))
    expect(guest.net.readyPeers()).toHaveLength(1) // still connected: nothing was sent

    const ben = joiner(codes.ben)
    await ben.net.start()
    await until(() => ben.state.synced, 'ben synced')
    expect((readTop(ben.doc, 'meta') as { name: string }).name).toBe('Game')
    await ben.net.stop()
    await guest.net.stop()
  }, 20_000)

  it('plugins list over the connection (empty here) and a bad key is refused', async () => {
    const t = new ServerTransport(codes.ana)
    await t.start(() => {})
    await t.connect()
    expect(await t.plugins()).toEqual([])
    await t.stop()
    const bad = new ServerTransport({ ...codes.ana, key: 'egd-key-wrong' })
    await bad.start(() => {})
    await expect(bad.connect()).rejects.toMatchObject({ reason: 'bad-key' })
  }, 20_000)
})
