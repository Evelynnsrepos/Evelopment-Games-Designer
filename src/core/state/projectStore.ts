import { create } from 'zustand'
import {
  createEntity,
  ENTITY_TYPES,
  newId,
  type Category,
  type ComponentType,
  type DocumentRef,
  type Entity,
  type EntityOf,
  type EntityType,
  type Id,
  type LayoutNode,
  type ProjectMeta,
} from '../model'
import {
  computeStats,
  createProject,
  deleteDocument,
  loadProject,
  saveCategories,
  saveCollection,
  saveMeta,
  upsertRecent,
  type EntityCollections,
  type NewProjectInput,
} from '../project'
import { flushAll, scheduleSave } from './autosave'

/**
 * The open project: meta, entities and categories. Every mutation updates
 * memory immediately and schedules a debounced write of the affected file.
 * Component documents live in documentStore.ts, not here.
 */
interface ProjectState {
  root: string | null
  meta: ProjectMeta | null
  entities: EntityCollections
  categories: Category[]

  open(root: string): Promise<void>
  create(input: NewProjectInput): Promise<void>
  close(): Promise<void>

  updateMeta(patch: Partial<ProjectMeta>): void
  setLayout(layout: LayoutNode | null): void
  enableComponent(type: ComponentType): void

  addDocument(type: ComponentType, title: string): DocumentRef
  renameDocument(id: Id, title: string): void
  removeDocument(id: Id): Promise<void>

  addEntity<T extends EntityType>(type: T, name?: string): EntityOf<T>
  updateEntity<T extends EntityType>(type: T, id: Id, patch: Partial<EntityOf<T>>): void
  removeEntity(type: EntityType, id: Id): void
  getEntity<T extends EntityType>(type: T, id: Id): EntityOf<T> | undefined
  /** Replace a whole collection at once, e.g. to restore an undo snapshot. */
  setEntities<T extends EntityType>(type: T, list: EntityOf<T>[]): void

  setCategories(categories: Category[]): void
}

const emptyEntities = (): EntityCollections => ({ item: [], character: [], town: [], enemy: [] })

export const useProjectStore = create<ProjectState>()((set, get) => {
  const saveMetaSoon = () => {
    const { root, meta } = get()
    if (root && meta) scheduleSave(`${root}|meta`, () => saveMeta(root, get().meta!))
  }
  const saveCollectionSoon = (type: EntityType) => {
    const root = get().root
    if (root) scheduleSave(`${root}|entities/${type}`, () => saveCollection(root, type, get().entities[type]))
  }

  const afterOpen = async (root: string, meta: ProjectMeta) => {
    await upsertRecent({
      path: root,
      name: meta.name,
      description: meta.description,
      lastOpened: new Date().toISOString(),
      stats: await computeStats(root),
    })
  }

  return {
    root: null,
    meta: null,
    entities: emptyEntities(),
    categories: [],

    async open(root) {
      await get().close()
      const p = await loadProject(root)
      set({ root: p.root, meta: p.meta, entities: p.entities, categories: p.categories })
      await afterOpen(p.root, p.meta)
    },

    async create(input) {
      await get().close()
      const p = await createProject(input)
      set({ root: p.root, meta: p.meta, entities: p.entities, categories: p.categories })
      await afterOpen(p.root, p.meta)
    },

    async close() {
      const { root, meta } = get()
      if (!root) return
      await flushAll(root)
      if (meta) {
        // Refresh launcher stats with everything just saved.
        await afterOpen(root, meta)
      }
      set({ root: null, meta: null, entities: emptyEntities(), categories: [] })
    },

    updateMeta(patch) {
      const meta = get().meta
      if (!meta) return
      set({ meta: { ...meta, ...patch } })
      saveMetaSoon()
    },

    setLayout(layout) {
      get().updateMeta({ layout })
    },

    enableComponent(type) {
      const meta = get().meta
      if (!meta || meta.enabledComponents.includes(type)) return
      get().updateMeta({ enabledComponents: [...meta.enabledComponents, type] })
    },

    addDocument(type, title) {
      const meta = get().meta!
      const t = new Date().toISOString()
      const doc: DocumentRef = { id: newId(), type, title, createdAt: t, updatedAt: t }
      get().updateMeta({ documents: [...meta.documents, doc] })
      return doc
    },

    renameDocument(id, title) {
      const meta = get().meta!
      get().updateMeta({ documents: meta.documents.map((d) => (d.id === id ? { ...d, title } : d)) })
    },

    async removeDocument(id) {
      const { meta, root } = get()
      const doc = meta?.documents.find((d) => d.id === id)
      if (!meta || !root || !doc) return
      get().updateMeta({ documents: meta.documents.filter((d) => d.id !== id) })
      await deleteDocument(root, doc.type, id)
    },

    addEntity(type, name) {
      const entity = createEntity(type, name)
      set({ entities: { ...get().entities, [type]: [...get().entities[type], entity] } })
      saveCollectionSoon(type)
      return entity
    },

    updateEntity(type, id, patch) {
      const list = get().entities[type] as Entity[]
      const next = list.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e))
      set({ entities: { ...get().entities, [type]: next } })
      saveCollectionSoon(type)
    },

    removeEntity(type, id) {
      const list = get().entities[type] as Entity[]
      set({ entities: { ...get().entities, [type]: list.filter((e) => e.id !== id) } })
      saveCollectionSoon(type)
    },

    getEntity(type, id) {
      return (get().entities[type] as Entity[]).find((e) => e.id === id) as EntityOf<typeof type> | undefined
    },

    setEntities(type, list) {
      set({ entities: { ...get().entities, [type]: list } })
      saveCollectionSoon(type)
    },

    setCategories(categories) {
      set({ categories })
      const root = get().root
      if (root) scheduleSave(`${root}|categories`, () => saveCategories(root, get().categories))
    },
  }
})

/** All entities of every type, handy for pickers and `[[` link search. */
export function allEntities(collections: EntityCollections): Entity[] {
  return ENTITY_TYPES.flatMap((t) => collections[t] as Entity[])
}
