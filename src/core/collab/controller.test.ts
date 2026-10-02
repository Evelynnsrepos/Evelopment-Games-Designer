import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryFs, setFs } from '../fs'
import { loadProject, readDocument } from '../project'
import { createBackup, restoreBackup } from '../backups'
import { flushAll, loadDocumentNow, updateDocument, useProjectStore } from '../state'
import {
  activeSession,
  installCollaboration,
  joinProject,
  newInviteCode,
  setJoinRequestHandler,
  setProfile,
  setTransportFactory,
  shareProject,
  stopSharingHere,
  useCollab,
} from './controller'
import { MemoryHub, MemoryTransport } from './memoryTransport'
import { CollabSession } from './session'

describe('collaboration controller', () => {
  let hub: MemoryHub
  let next = 0
  beforeEach(() => {
    setFs(new MemoryFs())
    hub = new MemoryHub()
    setTransportFactory(() => new MemoryTransport(hub, `device-${++next}`))
    installCollaboration()
    setProfile({ name: 'Eve', color: '#f0f' })
  })
  afterEach(async () => {
    await useProjectStore.getState().close()
  })

  it('shares a project, lets a teammate join and writes their copy', async () => {
    const store = useProjectStore.getState()
    await store.create({ name: 'Dungeon Game', description: 'dark', components: ['brainstorm', 'item-list'] })
    const root = useProjectStore.getState().root!
    store.addEntity('item', 'Torch')
    const board = store.addDocument('brainstorm', 'Ideas')
    await loadDocumentNow(root, 'brainstorm', board.id, () => ({ nodes: [] as { id: string }[] }))
    updateDocument<{ nodes: { id: string }[] }>(root, 'brainstorm', board.id, (d) => ({ nodes: [...d.nodes, { id: 'idea' }] }))

    const asked: string[] = []
    setJoinRequestHandler(async (r) => {
      asked.push(r.name)
      return true
    })
    const code = await shareProject()
    expect(code.startsWith('EGD1-')).toBe(true)
    expect(useCollab.getState().shared).toBe(true)
    expect(await CollabSession.isShared(root)).toBe(true)

    const join = joinProject(code, '/Joined')
    const joinedRoot = await join.done
    expect(asked).toEqual(['Eve'])
    expect(joinedRoot).toBe('/Joined/Dungeon Game')

    const copy = await loadProject(joinedRoot)
    expect(copy.meta.name).toBe('Dungeon Game')
    expect(copy.meta.layout).toBeNull()
    expect(copy.entities.item.map((i) => i.name)).toEqual(['Torch'])
    expect(copy.meta.documents.map((d) => d.title)).toEqual(['Ideas'])
    expect(await readDocument(joinedRoot, 'brainstorm', board.id, () => null)).toEqual({ nodes: [{ id: 'idea' }] })
    expect(await CollabSession.isShared(joinedRoot)).toBe(true)
    expect(useCollab.getState().members).toHaveLength(2)
  })

  it('reports a rejected join in plain words', async () => {
    await useProjectStore.getState().create({ name: 'Secret', description: '', components: [] })
    setJoinRequestHandler(async () => false)
    const code = await shareProject()
    await expect(joinProject(code, '/Joined').done).rejects.toThrow('did not let you in')
  })

  it('rejects old codes after making a new one', async () => {
    await useProjectStore.getState().create({ name: 'Rotate', description: '', components: [] })
    setJoinRequestHandler(async () => true)
    const old = await shareProject()
    await newInviteCode()
    await expect(joinProject(old, '/Joined').done).rejects.toThrow('no longer valid')
  })

  it('goes online again when a shared project is reopened, and can stop sharing', async () => {
    await useProjectStore.getState().create({ name: 'Again', description: '', components: [] })
    const root = useProjectStore.getState().root!
    await shareProject()
    await useProjectStore.getState().close()
    expect(useCollab.getState().shared).toBe(false)

    await useProjectStore.getState().open(root)
    expect(useCollab.getState().shared).toBe(true)
    await stopSharingHere()
    expect(await CollabSession.isShared(root)).toBe(false)
  })

  it('refuses nonsense invite codes', async () => {
    await expect(joinProject('hello', '/x').done).rejects.toThrow('not a valid invite code')
  })

  it('shares a restored backup instead of loading the old shared copy over it', async () => {
    const store = useProjectStore.getState()
    await store.create({ name: 'Restore', description: '', components: ['item-list'] })
    const root = useProjectStore.getState().root!
    await shareProject()
    store.addEntity('item', 'Torch')
    await flushAll(root)
    const backup = await createBackup(root, 'autosave')
    useProjectStore.getState().addEntity('item', 'Rope')
    await useProjectStore.getState().close()

    await restoreBackup(root, backup!.id)
    await useProjectStore.getState().open(root)
    expect(useProjectStore.getState().entities.item.map((i) => i.name)).toEqual(['Torch'])
    expect((activeSession()!.read('entities:item') as { name: string }[]).map((i) => i.name)).toEqual(['Torch'])
    await flushAll(root)
    expect((await loadProject(root)).entities.item.map((i) => i.name)).toEqual(['Torch'])
  })
})
