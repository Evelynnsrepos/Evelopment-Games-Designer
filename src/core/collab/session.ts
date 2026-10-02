import * as Y from 'yjs'
import { getFs } from '../fs'
import { ENTITY_TYPES, type Category, type ComponentType, type Entity, type EntityType, type ProjectMeta } from '../model'
import { projectPaths, readVersioned, type LoadedProject } from '../project'
import {
  isLocalOnlyType,
  collabNames,
  flush,
  isTextName,
  forgetSharedDocument,
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
import { invalidate, isRemoved, readTop, REMOVED, writeTop } from './bridge'

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
  /** Device id of the person who shared the project. Projects shared before this existed use the first member. */
  hostId?: string
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
  static async create(
    root: string,
    project: Pick<LoadedProject, 'meta' | 'entities' | 'categories'>,
    share: ShareInfo,
    self: Member | null,
  ) {
    const session = new CollabSession(root)
    const docs = await readAllDocuments(root)
    session.doc.transact(() => {
      writeTop(session.doc, collabNames.meta, undefined, sharedMeta(project.meta))
      for (const type of ENTITY_TYPES) writeTop(session.doc, collabNames.entities(type), undefined, project.entities[type])
      writeTop(session.doc, collabNames.categories, undefined, project.categories)
      for (const [name, data] of docs) writeTop(session.doc, name, undefined, data)
      writeTop(session.doc, SHARE_INFO, undefined, share)
      writeTop(session.doc, MEMBERS, undefined, self ? [self] : [])
    }, ORIGIN.import)
    await session.saveNow()
    return session
  }

  /**
   * After a backup was restored: make the files on disk the shared state, so
   * teammates get the restored project too. Documents not in the backup are removed.
   */
  async replaceWithFiles(project: Pick<LoadedProject, 'meta' | 'entities' | 'categories'>) {
    const docs = await readAllDocuments(this.root)
    const replace = (name: string, next: unknown) => writeTop(this.doc, name, readTop(this.doc, name), next)
    this.doc.transact(() => {
      replace(collabNames.meta, sharedMeta(project.meta))
      for (const type of ENTITY_TYPES) replace(collabNames.entities(type), project.entities[type])
      replace(collabNames.categories, project.categories)
      for (const [name, data] of docs) replace(name, data)
      // Live text is filled again from the restored files when next opened.
      for (const key of [...this.doc.share.keys()]) {
        if (!isTextName(key)) continue
        const text = this.doc.getXmlFragment(key)
        text.delete(0, text.length)
      }
    }, ORIGIN.untracked)
    for (const name of [...this.doc.share.keys()]) {
      if (parseDocumentName(name) && !docs.has(name) && readTop(this.doc, name) !== undefined) this.removeDocument(name)
    }
    for (const um of this.undoManagers.values()) um.clear()
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

  removeDocument(name: string) {
    if (!this.doc.share.has(name)) return
    this.doc.transact(() => {
      const map = this.doc.getMap(name)
      for (const key of [...map.keys()]) map.delete(key)
      map.set(REMOVED, true)
      for (const key of [...this.doc.share.keys()]) {
        if (!key.startsWith(collabNames.text(name, ''))) continue
        const text = this.doc.getXmlFragment(key)
        text.delete(0, text.length)
      }
    }, ORIGIN.untracked)
    this.undoManagers.get(name)?.clear()
  }

  removeDocumentsOfType(type: ComponentType) {
    const prefix = collabNames.document(type, '')
    for (const name of [...this.doc.share.keys()]) if (name.startsWith(prefix)) this.removeDocument(name)
  }

  importDocument(name: string, value: unknown) {
    if (readTop(this.doc, name) !== undefined || isRemoved(this.doc, name)) return
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

  // ---- rich text ------------------------------------------------------------

  /**
   * The live text of a document field (`collabNames.text`). An empty one is
   * filled by `seed` from the saved JSON. The seed is written under a client id
   * derived from the name and content, so two devices seeding the same text
   * while apart produce identical edits that merge into one copy.
   */
  richText(name: string, seedKey: string, seed: (fragment: Y.XmlFragment) => void): Y.XmlFragment {
    const fragment = this.doc.getXmlFragment(name)
    if (fragment.length > 0) return fragment
    const temp = new Y.Doc()
    // After the text was cleared (a restore), the same seed needs a fresh id: the old one's edits are already here.
    let attempt = 0
    do temp.clientID = hash32(`${name}\n${seedKey}\n${attempt++}`)
    while (this.doc.store.clients.has(temp.clientID))
    seed(temp.getXmlFragment(name))
    if (temp.getXmlFragment(name).length > 0) Y.applyUpdate(this.doc, Y.encodeStateAsUpdate(temp), ORIGIN.import)
    temp.destroy()
    return fragment
  }

  // ---- share info -----------------------------------------------------------

  get shareInfo(): ShareInfo | undefined {
    return readTop(this.doc, SHARE_INFO) as ShareInfo | undefined
  }

  setShareInfo(next: ShareInfo) {
    this.doc.transact(() => writeTop(this.doc, SHARE_INFO, this.shareInfo, next), ORIGIN.untracked)
  }

  /** The host's device id: the person who shared the project. */
  get hostId(): string | undefined {
    const info = this.shareInfo
    if (info?.hostId) return info.hostId
    return [...this.members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0]?.id
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
    if (isRemoved(this.doc, name)) {
      const removed = parseDocumentName(name)
      if (removed) forgetSharedDocument(this.root, removed.type, removed.id)
      return
    }
    const value = readTop(this.doc, name)
    if (value === undefined) return
    if (name === collabNames.meta) return receiveSharedMeta(this.root, value as SharedMeta)
    if (name === collabNames.categories) return receiveSharedCategories(this.root, value as Category[])
    if (name.startsWith('entities:')) return receiveSharedEntities(this.root, name.slice(9) as EntityType, value as Entity[])
    const doc = parseDocumentName(name)
    // Local-only tools (Sketch) may still have old shared copies from before; each computer keeps its own.
    if (doc && !isLocalOnlyType(doc.type)) receiveSharedDocument(this.root, doc.type, doc.id, value)
  }
}

function scopeOf(name: string): string | null {
  if (name === collabNames.categories || name.startsWith('entities:')) return collabNames.project
  if (name.startsWith('doc:')) return name
  return null
}

/** FNV-1a, never 0 (a valid Yjs client id). */
function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0 || 1
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
