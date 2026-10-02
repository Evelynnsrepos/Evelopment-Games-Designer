import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { MemoryFs, setFs } from '../fs'
import {
  flushAll,
  loadDocumentNow,
  peekDocument,
  redoDocument,
  setCollabBinding,
  undoDocument,
  updateDocument,
  useProjectStore,
} from '../state'
import { invalidate, readTop, writeTop } from './bridge'
import { CollabSession, ORIGIN } from './session'

interface Board {
  title: string
  nodes: { id: string; x: number; text?: string }[]
}

/** A second device, kept in sync with the session by hand. */
function connect(session: CollabSession) {
  const remote = new Y.Doc()
  remote.on('afterTransaction', invalidate)
  const peer = { name: 'peer' }
  session.doc.on('update', (u: Uint8Array, origin: unknown) => {
    if (origin !== peer) Y.applyUpdate(remote, u, peer)
  })
  remote.on('update', (u: Uint8Array, origin: unknown) => {
    if (origin !== peer) Y.applyUpdate(session.doc, u, peer)
  })
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(session.doc), peer)
  const edit = (name: string, fn: (v: never) => unknown) =>
    remote.transact(() => {
      const prev = readTop(remote, name)
      writeTop(remote, name, prev, fn(prev as never))
    })
  return { remote, edit }
}

async function sharedProject() {
  const store = useProjectStore.getState()
  await store.create({ name: `Shared ${Math.random()}`, description: '', components: ['brainstorm', 'item-list'] })
  const { root, meta, entities, categories } = useProjectStore.getState()
  const session = await CollabSession.create(
    root!,
    { meta: meta!, entities, categories },
    { projectId: meta!.id, secret: 'secret' },
    { id: 'me', name: 'Me', color: '#f0f', joinedAt: '' },
  )
  setCollabBinding(session)
  return { root: root!, session }
}

describe('collab session', () => {
  beforeEach(() => setFs(new MemoryFs()))
  afterEach(async () => {
    setCollabBinding(null)
    await useProjectStore.getState().close()
  })

  it('shares entity changes both ways', async () => {
    const { root, session } = await sharedProject()
    const { remote, edit } = connect(session)

    const sword = useProjectStore.getState().addEntity('item', 'Sword')
    expect((readTop(remote, 'entities:item') as { name: string }[]).map((e) => e.name)).toEqual(['Sword'])

    edit('entities:item', (list: { id: string; name: string }[]) => list.map((e) => ({ ...e, name: 'Great Sword' })))
    expect(useProjectStore.getState().getEntity('item', sword.id)?.name).toBe('Great Sword')
    expect(useProjectStore.getState().root).toBe(root)
  })

  it('keeps personal layout out of the shared meta', async () => {
    const { session } = await sharedProject()
    const { remote, edit } = connect(session)
    useProjectStore.getState().updateMeta({ sidebarCollapsed: true })
    expect((readTop(remote, 'meta') as Record<string, unknown>).sidebarCollapsed).toBeUndefined()

    edit('meta', (m: Record<string, unknown>) => ({ ...m, name: 'Renamed' }))
    const meta = useProjectStore.getState().meta!
    expect(meta.name).toBe('Renamed')
    expect(meta.sidebarCollapsed).toBe(true)
  })

  it('syncs documents and undoes only this device’s changes', async () => {
    const { root, session } = await sharedProject()
    const { remote, edit } = connect(session)
    const id = 'board-1'
    await loadDocumentNow<Board>(root, 'brainstorm', id, () => ({ title: 'Ideas', nodes: [] }))

    updateDocument<Board>(root, 'brainstorm', id, (d) => ({ ...d, nodes: [...d.nodes, { id: 'n1', x: 0 }] }))
    expect(readTop(remote, `doc:brainstorm/${id}`)).toEqual({ title: 'Ideas', nodes: [{ id: 'n1', x: 0 }] })

    // The other person adds a note and renames the board.
    edit(`doc:brainstorm/${id}`, (d: Board) => ({ title: 'Big ideas', nodes: [...d.nodes, { id: 'n2', x: 5, text: 'theirs' }] }))
    expect(peekDocument<Board>(root, 'brainstorm', id)).toEqual({
      title: 'Big ideas',
      nodes: [{ id: 'n1', x: 0 }, { id: 'n2', x: 5, text: 'theirs' }],
    })

    // Undo removes only my note.
    undoDocument(root, 'brainstorm', id)
    expect(peekDocument<Board>(root, 'brainstorm', id)).toEqual({ title: 'Big ideas', nodes: [{ id: 'n2', x: 5, text: 'theirs' }] })
    redoDocument(root, 'brainstorm', id)
    expect(peekDocument<Board>(root, 'brainstorm', id)?.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
  })

  it('makes a drag one undo step', async () => {
    const { root } = await sharedProject()
    const id = 'board-2'
    await loadDocumentNow<Board>(root, 'brainstorm', id, () => ({ title: '', nodes: [{ id: 'n', x: 0 }] }))
    updateDocument<Board>(root, 'brainstorm', id, (d) => ({ ...d, title: 'first' }))
    for (let x = 1; x <= 5; x++) updateDocument<Board>(root, 'brainstorm', id, (d) => ({ ...d, nodes: [{ id: 'n', x }] }), { undoable: false })
    updateDocument<Board>(root, 'brainstorm', id, (d) => ({ ...d, nodes: [{ id: 'n', x: 6 }] }))
    undoDocument(root, 'brainstorm', id)
    expect(peekDocument<Board>(root, 'brainstorm', id)).toEqual({ title: 'first', nodes: [{ id: 'n', x: 0 }] })
  })

  it('saves and reloads the shared state', async () => {
    const { root, session } = await sharedProject()
    useProjectStore.getState().addEntity('town', 'Ironhold')
    await flushAll(root)
    await session.close()
    expect(await CollabSession.isShared(root)).toBe(true)
    const loaded = await CollabSession.load(root)
    expect((loaded.read('entities:town') as { name: string }[])[0].name).toBe('Ironhold')
    expect(loaded.shareInfo?.secret).toBe('secret')
    expect(loaded.members.map((m) => m.id)).toEqual(['me'])
  })

  it('adds documents that existed before sharing', async () => {
    const { root, session } = await sharedProject()
    session.doc.transact(() => writeTop(session.doc, 'x', undefined, { a: 1 }), ORIGIN.import)
    const { remote } = connect(session)
    await loadDocumentNow<Board>(root, 'brainstorm', 'new', () => ({ title: 'default', nodes: [] }))
    // A default for a document nobody saved is not shared until someone edits it.
    expect(readTop(remote, 'doc:brainstorm/new')).toBeUndefined()
  })
})
