import * as Y from 'yjs'
import { getFs } from '../fs'
import { ENTITY_TYPES, type Category, type Entity, type EntityType, type ProjectMeta } from '../model'
import { projectPaths, readVersioned, type LoadedProject } from '../project'
import {
  collabNames,
  flush,
  parseDocumentName,
  receiveSharedCategories,
  receiveSharedDocument,
  receiveSharedEntities,
  receiveSharedMeta,
  scheduleSave,
  sharedMeta,
  useProjectStore,
  type CollabBinding,
  type SharedMeta,
} from '../state'
import { invalidate, readTop, writeTop } from './bridge'

// oxlint-disable-next-line no-explicit-any -- Yjs types are invariant in their event type
type AnyType = Y.AbstractType<any>

/** Transaction origins. Remote changes use the connection as origin. */
export const ORIGIN = {
  /** This device, undoable. */
  local: { name: 'local' },
  /** This device, never undone (e.g. document renames in the sidebar). */
  untracked: { name: 'untracked' },
  /** Loading files or the saved state. */
  import: { name: 'import' },
} as const

const LOCAL_ORIGINS = new Set<unknown>([ORIGIN.local, ORIGIN.untracked, ORIGIN.import])

/** Top-level names that are not store documents. */
export const SHARE_INFO = 'share'
export const MEMBERS = 'members'

export interface ShareInfo {
  /** Same as the project's meta id; peers refuse to sync different projects. */
  projectId: string
  /** Random, base64url. Proves an invite is real. A new invite code replaces it. */
  secret: string
}

export interface Member {
  /** Device id (iroh endpoint id). */
  id: string
  name: string
  color: string
  joinedAt: string
}

/**
 * The shared state of one open project: a Yjs document mirrored into the
 * stores, saved to `collab/state.bin`, with undo that only covers this
 * device's own changes.
 */
export class CollabSession implements CollabBinding {
  readonly doc: Y.Doc
  private readonly undoManagers = new Map<string, Y.UndoManager>()
  private readonly names = new Map<AnyType, string>()
  private readonly listeners = new Set<(names: Set<string>, origin: unknown) => void>()
  private closed = false

  readonly root: string

  constructor(root: string, doc = new Y.Doc()) {
    this.root = root
    this.doc = doc
    doc.on('afterTransaction', (tr: Y.Transaction) => {
      invalidate(tr)
      if (tr.changed.size === 0 || this.closed) return
      const changed = this.changedNames(tr)
      if (!LOCAL_ORIGINS.has(tr.origin)) for (const name of changed) this.pushToStores(name)
      for (const fn of this.listeners) fn(changed, tr.origin)
    })
    doc.on('update', () => {
      if (!this.closed) this.saveSoon()
    })
  }

  // ---- loading and creating ------------------------------------------------

  static async isShared(root: string): Promise<boolean> {
    return getFs().exists(await projectPaths.collabState(root))
  }

  /** Open a shared project from its saved state. */
  static async load(root: string): Promise<CollabSession> {
    const session = new CollabSession(root)
    const bytes = await getFs().readBinary(await projectPaths.collabState(root))
    Y.applyUpdate(session.doc, bytes, ORIGIN.import)
    return session
  }

  /** Start sharing a project: copy everything on disk into the shared state. */
  static async create(root: string, project: Pick<LoadedProject, 'meta' | 'entities' | 'categories'>, share: ShareInfo, self: Member) {
    const session = new CollabSession(root)
    const docs = await readAllDocuments(root)
    session.doc.transact(() => {
      writeTop(session.doc, collabNames.meta, undefined, sharedMeta(project.meta))
      for (const type of ENTITY_TYPES) writeTop(session.doc, collabNames.entities(type), undefined, project.entities[type])
      writeTop(session.doc, collabNames.categories, undefined, project.categories)
      for (const [name, data] of docs) writeTop(session.doc, name, undefined, data)
      writeTop(session.doc, SHARE_INFO, undefined, share)
      writeTop(session.doc, MEMBERS, undefined, [self])
    }, ORIGIN.import)
    await session.saveNow()
    return session
  }

  /** Bring the stores in line with the shared state (after loading or joining). */
  pullAll() {
    for (const name of this.doc.share.keys()) this.pushToStores(name)
  }

  // ---- CollabBinding --------------------------------------------------------

  read(name: string): unknown {
    return readTop(this.doc, name)
  }

  write(name: string, prev: unknown, next: unknown, options?: { undoable?: boolean; track?: boolean }) {
    const track = options?.track !== false
    const scope = track ? scopeOf(name) : null
    const um = scope ? this.undoManager(scope) : null
    // First edit of a document nobody shared yet: share its starting state
    // separately, so undo removes only the edit, not the whole document.
    if (prev !== undefined && readTop(this.doc, name) === undefined) {
      this.doc.transact(() => writeTop(this.doc, name, undefined, prev), ORIGIN.import)
    }
    this.doc.transact(() => writeTop(this.doc, name, prev, next), um ? ORIGIN.local : ORIGIN.untracked)
    // A drag sends many `undoable: false` updates and ends with an undoable one:
    // they become one undo step, and the next change starts a new one.
    if (um && options?.undoable !== false) um.stopCapturing()
  }

  importDocument(name: string, value: unknown) {
    if (readTop(this.doc, name) !== undefined) return
    this.doc.transact(() => writeTop(this.doc, name, undefined, value), ORIGIN.import)
  }

  undo(scope: string) {
    this.undoManager(scope).undo()
  }
  redo(scope: string) {
    this.undoManager(scope).redo()
  }
  canUndo(scope: string) {
    return this.undoManagers.get(scope)?.canUndo() ?? false
  }
  canRedo(scope: string) {
    return this.undoManagers.get(scope)?.canRedo() ?? false
  }
  boundary(scope: string) {
    this.undoManager(scope).stopCapturing()
  }

  // ---- share info -----------------------------------------------------------

  get shareInfo(): ShareInfo | undefined {
    return readTop(this.doc, SHARE_INFO) as ShareInfo | undefined
  }

  setShareInfo(next: ShareInfo) {
    this.doc.transact(() => writeTop(this.doc, SHARE_INFO, this.shareInfo, next), ORIGIN.untracked)
  }

  get members(): Member[] {
    return (readTop(this.doc, MEMBERS) as Member[] | undefined) ?? []
  }

  setMembers(next: Member[]) {
    this.doc.transact(() => writeTop(this.doc, MEMBERS, this.members, next), ORIGIN.untracked)
  }

  /** Called with the top-level names each transaction changed. */
  onChange(fn: (names: Set<string>, origin: unknown) => void) {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }

  // ---- saving ---------------------------------------------------------------

  private saveKey() {
    return `${this.root}|collab/state`
  }

  private saveSoon() {
    scheduleSave(this.saveKey(), () => this.writeState())
  }

  async saveNow() {
    this.saveSoon()
    await flush(this.saveKey())
  }

  private async writeState() {
    const fs = getFs()
    await fs.mkdir(await projectPaths.collabDir(this.root))
    await fs.writeBinaryAtomic(await projectPaths.collabState(this.root), Y.encodeStateAsUpdate(this.doc))
  }

  async close() {
    await this.saveNow()
    this.closed = true
    for (const um of this.undoManagers.values()) um.destroy()
    this.undoManagers.clear()
    this.listeners.clear()
  }

  // ---- internals ------------------------------------------------------------

  private undoManager(scope: string): Y.UndoManager {
    let um = this.undoManagers.get(scope)
    if (!um) {
      const types =
        scope === collabNames.project
          ? [...ENTITY_TYPES.map((t) => this.doc.getMap(collabNames.entities(t))), this.doc.getMap(collabNames.categories)]
          : [this.doc.getMap(scope)]
      um = new Y.UndoManager(types, { trackedOrigins: new Set([ORIGIN.local]), captureTimeout: 500 })
      this.undoManagers.set(scope, um)
    }
    return um
  }

  private changedNames(tr: Y.Transaction): Set<string> {
    const out = new Set<string>()
    for (const type of tr.changed.keys()) {
      let t: AnyType = type
      while (t._item) t = t._item.parent as AnyType
      const name = this.nameOf(t)
      if (name) out.add(name)
    }
    return out
  }

  private nameOf(type: AnyType): string | undefined {
    let name = this.names.get(type)
    if (!name) {
      for (const [k, v] of this.doc.share) this.names.set(v, k)
      name = this.names.get(type)
    }
    return name
  }

  private pushToStores(name: string) {
    const value = readTop(this.doc, name)
    if (value === undefined) return
    if (name === collabNames.meta) return receiveSharedMeta(this.root, value as SharedMeta)
    if (name === collabNames.categories) return receiveSharedCategories(this.root, value as Category[])
    if (name.startsWith('entities:')) return receiveSharedEntities(this.root, name.slice(9) as EntityType, value as Entity[])
    const doc = parseDocumentName(name)
    if (doc) receiveSharedDocument(this.root, doc.type, doc.id, value)
  }
}

function scopeOf(name: string): string | null {
  if (name === collabNames.categories || name.startsWith('entities:')) return collabNames.project
  if (name.startsWith('doc:')) return name
  return null
}

/** Every component document on disk, by shared name. */
async function readAllDocuments(root: string): Promise<Map<string, unknown>> {
  const fs = getFs()
  const out = new Map<string, unknown>()
  const componentsDir = await fs.join(root, 'components')
  if (!(await fs.exists(componentsDir))) return out
  for (const typeDir of await fs.list(componentsDir)) {
    if (!typeDir.isDirectory) continue
    const dir = await fs.join(componentsDir, typeDir.name)
    for (const file of await fs.list(dir)) {
      if (file.isDirectory || !file.name.endsWith('.json')) continue
      try {
        const data = await readVersioned<unknown>(await fs.join(dir, file.name))
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          out.set(`doc:${typeDir.name}/${file.name.slice(0, -5)}`, data)
        }
      } catch (error) {
        console.error(`Could not share ${typeDir.name}/${file.name}`, error)
      }
    }
  }
  return out
}

/** The meta of the open project, for convenience. */
export function currentMeta(): ProjectMeta | null {
  return useProjectStore.getState().meta
}
