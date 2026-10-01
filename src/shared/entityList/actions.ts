import { create } from 'zustand'
import { newId, type Category, type CategoryValue, type EntityBase, type EntityOf, type EntityType, type Id } from '@/core/model'
import { History, useProjectStore } from '@/core/state'
import { applyToEntity, forgetEntity, removeFromEntity, renameOptionValues, type CategoryChange } from '@/shared/categories'

/**
 * Undoable commands for one entity list (spec 3.5). Entities live in
 * projectStore, which has no history, so each change first snapshots this
 * type's collection plus the shared categories. Snapshots share unchanged
 * objects, so they are cheap.
 *
 * Changes with the same `group` within GROUP_MS (typing in one field) form one undo step.
 */
const GROUP_MS = 1500

interface Snapshot<T extends EntityType> {
  list: EntityOf<T>[]
  categories: Category[]
}

interface Track<T extends EntityType> {
  history: History<Snapshot<T>>
  lastGroup: string | null
  lastAt: number
}

export interface EntityActions<T extends EntityType> {
  type: T
  /** Re-renders the caller after every change, undo or redo (for toolbar button state). */
  useVersion(): number
  /** Run `fn` as one undoable change. */
  change(group: string | null, fn: () => void): void
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  add(name: string): EntityOf<T>
  duplicate(id: Id): EntityOf<T> | undefined
  update(id: Id, patch: Partial<EntityOf<T>>, group?: string | null): void
  setCategoryValue(id: Id, categoryId: Id, value: CategoryValue): void
  setCategories(next: Category[]): void
  /** Apply a change from the category manager, including renamed dropdown options. */
  applyCategoryChange(change: CategoryChange): void
  /** Show a category on several entities at once ("only selected", IT-5). */
  addCategoryTo(categoryId: Id, ids: Id[]): void
  removeCategoryFrom(categoryId: Id, ids: Id[]): void
  /** Delete entities. References elsewhere are kept (they show as missing), so undo restores everything. */
  remove(ids: Id[]): void
}

/** Deep copy of an entity's fields, giving nested rows (links, drop rows) fresh ids. */
export function cloneFields<E extends EntityBase>(source: E): Omit<E, 'id' | 'createdAt' | 'updatedAt' | 'name'> {
  const { id: _id, createdAt: _c, updatedAt: _u, name: _n, ...rest } = structuredClone(source)
  for (const value of Object.values(rest)) {
    if (!Array.isArray(value)) continue
    for (const row of value) if (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string') (row as { id: Id }).id = newId()
  }
  return rest
}

export function createEntityActions<T extends EntityType>(type: T): EntityActions<T> {
  const tracks = new Map<string, Track<T>>()
  const versionStore = create<{ version: number }>()(() => ({ version: 0 }))
  const bump = () => versionStore.setState((s) => ({ version: s.version + 1 }))
  const store = () => useProjectStore.getState()
  const list = () => store().entities[type] as EntityOf<T>[]

  const track = (): Track<T> | null => {
    const root = store().root
    if (!root) return null
    let t = tracks.get(root)
    if (!t) tracks.set(root, (t = { history: new History<Snapshot<T>>(), lastGroup: null, lastAt: 0 }))
    return t
  }
  const snapshot = (): Snapshot<T> => ({ list: list(), categories: store().categories })
  const restore = (snap: Snapshot<T>) => {
    store().setEntities(type, snap.list)
    store().setCategories(snap.categories)
  }

  const change = (group: string | null, fn: () => void) => {
    const t = track()
    if (!t) return
    const now = Date.now()
    if (!(group && t.lastGroup === group && now - t.lastAt < GROUP_MS)) t.history.record(snapshot())
    t.lastGroup = group
    t.lastAt = now
    fn()
    bump()
  }

  const step = (dir: 'undo' | 'redo') => {
    const t = track()
    const snap = t?.history[dir](snapshot())
    if (!t || !snap) return
    t.lastGroup = null
    restore(snap)
    bump()
  }

  const setCategories = (next: Category[]) => change(null, () => store().setCategories(next))

  return {
    type,
    useVersion: () => versionStore((s) => s.version),
    change,
    undo: () => step('undo'),
    redo: () => step('redo'),
    canUndo: () => !!track()?.history.canUndo,
    canRedo: () => !!track()?.history.canRedo,

    add(name) {
      let entity: EntityOf<T> | undefined
      change(null, () => {
        entity = store().addEntity(type, name)
      })
      return entity!
    },

    duplicate(id) {
      const source = store().getEntity(type, id)
      if (!source) return
      let copy: EntityOf<T> | undefined
      change(null, () => {
        const created = store().addEntity(type, `${source.name} copy`)
        store().updateEntity(type, created.id, cloneFields(source) as unknown as Partial<EntityOf<T>>)
        // Show the copy wherever the original shows "only selected" categories.
        store().setCategories(
          store().categories.map((c) => {
            const scope = c.appliesTo[type]
            return scope?.mode === 'selected' && scope.ids.includes(id) ? applyToEntity(c, type, created.id) : c
          }),
        )
        copy = store().getEntity(type, created.id)
      })
      return copy
    },

    update(id, patch, group = null) {
      change(group, () => store().updateEntity(type, id, patch))
    },

    setCategoryValue(id, categoryId, value) {
      const entity = store().getEntity(type, id)
      if (!entity) return
      change(`value:${id}:${categoryId}`, () =>
        store().updateEntity(type, id, { categories: { ...entity.categories, [categoryId]: value } } as Partial<EntityOf<T>>),
      )
    },

    setCategories,

    applyCategoryChange({ categories, renamed }) {
      change(null, () => {
        store().setCategories(categories)
        if (renamed) renameOptionValues(renamed.categoryId, renamed.renamed)
      })
    },

    addCategoryTo(categoryId, ids) {
      change(null, () => {
        store().setCategories(store().categories.map((c) => (c.id === categoryId ? ids.reduce((acc, id) => applyToEntity(acc, type, id), c) : c)))
      })
    },

    removeCategoryFrom(categoryId, ids) {
      const allIds = list().map((e) => e.id)
      change(null, () => {
        store().setCategories(
          store().categories.map((c) => {
            if (c.id !== categoryId) return c
            let next = c
            for (const id of ids) next = removeFromEntity(next, type, id, allIds)
            return next
          }),
        )
      })
    },

    remove(ids) {
      change(null, () => {
        const gone = new Set(ids)
        store().setEntities(
          type,
          list().filter((e) => !gone.has(e.id)),
        )
        let cats = store().categories
        for (const id of ids) cats = forgetEntity(cats, type, id)
        if (cats !== store().categories) store().setCategories(cats)
      })
    },
  }
}
