import { create } from 'zustand'
import type { Category, CategoryValue, Id, Item } from '@/core/model'
import { collabNames, getCollabBinding, History, useProjectStore } from '@/core/state'
import { applyToEntity, forgetEntity, removeFromEntity, renameOptionValues, type CategoryChange } from '@/shared/categories'

/**
 * Item List commands with undo/redo (spec 3.5). Entities live in projectStore,
 * which has no history, so this module snapshots items + categories before each
 * change. Snapshots share unchanged objects, so they are cheap.
 *
 * Changes with the same `group` within GROUP_MS (typing in one field) form one undo step.
 */
interface Snapshot {
  items: Item[]
  categories: Category[]
}

const GROUP_MS = 1500

interface Track {
  history: History<Snapshot>
  lastGroup: string | null
  lastAt: number
}

const tracks = new Map<string, Track>()

/** Bumps on every change so toolbar buttons re-render their enabled state. */
export const useItemHistoryVersion = create<{ version: number }>()(() => ({ version: 0 }))
const bump = () => useItemHistoryVersion.setState((s) => ({ version: s.version + 1 }))

function track(): Track | null {
  const root = useProjectStore.getState().root
  if (!root) return null
  let t = tracks.get(root)
  if (!t) tracks.set(root, (t = { history: new History<Snapshot>(), lastGroup: null, lastAt: 0 }))
  return t
}

function snapshot(): Snapshot {
  const s = useProjectStore.getState()
  return { items: s.entities.item, categories: s.categories }
}

function restore(snap: Snapshot) {
  const s = useProjectStore.getState()
  s.setEntities('item', snap.items)
  s.setCategories(snap.categories)
}

/** Run `fn` as one undoable change. */
export function change(group: string | null, fn: () => void) {
  const t = track()
  if (!t) return
  const now = Date.now()
  const sameGroup = group && t.lastGroup === group && now - t.lastAt < GROUP_MS
  // In a shared project undo only covers this device's changes (core/collab).
  const collab = getCollabBinding(useProjectStore.getState().root)
  if (collab) {
    if (!sameGroup) collab.boundary(collabNames.project)
  } else if (!sameGroup) t.history.record(snapshot())
  t.lastGroup = group
  t.lastAt = now
  fn()
  bump()
}

function collabStep(dir: 'undo' | 'redo'): boolean {
  const collab = getCollabBinding(useProjectStore.getState().root)
  if (!collab) return false
  collab[dir](collabNames.project)
  const t = track()
  if (t) t.lastGroup = null
  bump()
  return true
}

export function undo() {
  if (collabStep('undo')) return
  const t = track()
  const prev = t?.history.undo(snapshot())
  if (!t || !prev) return
  t.lastGroup = null
  restore(prev)
  bump()
}

export function redo() {
  if (collabStep('redo')) return
  const t = track()
  const next = t?.history.redo(snapshot())
  if (!t || !next) return
  t.lastGroup = null
  restore(next)
  bump()
}

export function canUndo() {
  return getCollabBinding(useProjectStore.getState().root)?.canUndo(collabNames.project) ?? !!track()?.history.canUndo
}
export function canRedo() {
  return getCollabBinding(useProjectStore.getState().root)?.canRedo(collabNames.project) ?? !!track()?.history.canRedo
}

const store = () => useProjectStore.getState()

export const NEW_ITEM_NAME = 'New item'

export function addItem(): Item {
  let item: Item | undefined
  change(null, () => {
    item = store().addEntity('item', NEW_ITEM_NAME)
  })
  return item!
}

export function duplicateItem(id: Id): Item | undefined {
  const source = store().getEntity('item', id)
  if (!source) return
  let copy: Item | undefined
  change(null, () => {
    const created = store().addEntity('item', `${source.name} copy`)
    const { id: _id, createdAt: _c, updatedAt: _u, name: _n, ...rest } = source
    store().updateEntity('item', created.id, { ...rest, stats: { ...source.stats }, categories: { ...source.categories } })
    // Show the copy wherever the original shows "only selected" categories.
    store().setCategories(store().categories.map((c) => (c.appliesTo.item?.mode === 'selected' && c.appliesTo.item.ids.includes(id) ? applyToEntity(c, 'item', created.id) : c)))
    copy = store().getEntity('item', created.id)
  })
  return copy
}

export function updateItem(id: Id, patch: Partial<Item>, group: string | null = null) {
  change(group, () => store().updateEntity('item', id, patch))
}

export function setCategoryValue(id: Id, categoryId: Id, value: CategoryValue) {
  const item = store().getEntity('item', id)
  if (!item) return
  change(`value:${id}:${categoryId}`, () => store().updateEntity('item', id, { categories: { ...item.categories, [categoryId]: value } }))
}

export function setCategories(next: Category[]) {
  change(null, () => store().setCategories(next))
}

/** Apply a change from the category manager, including renamed dropdown options. */
export function applyCategoryChange({ categories, renamed }: CategoryChange) {
  change(null, () => {
    store().setCategories(categories)
    if (renamed) renameOptionValues(renamed.categoryId, renamed.renamed)
  })
}

/** Show a category on several items at once (IT-5 "only selected items"). */
export function addCategoryToItems(categoryId: Id, ids: Id[]) {
  change(null, () => {
    store().setCategories(store().categories.map((c) => (c.id === categoryId ? ids.reduce((acc, id) => applyToEntity(acc, 'item', id), c) : c)))
  })
}

export function removeCategoryFromItems(categoryId: Id, ids: Id[]) {
  const allIds = store().entities.item.map((i) => i.id)
  change(null, () => {
    store().setCategories(
      store().categories.map((c) => {
        if (c.id !== categoryId) return c
        let next = c
        for (const id of ids) next = removeFromEntity(next, 'item', id, allIds)
        return next
      }),
    )
  })
}

/**
 * Delete items. Drop table rows in enemies that point at them are kept
 * (they show as a missing item), so undo brings everything back intact.
 */
export function deleteItems(ids: Id[]) {
  change(null, () => {
    const set = new Set(ids)
    store().setEntities('item', store().entities.item.filter((i) => !set.has(i.id)))
    let cats = store().categories
    for (const id of ids) cats = forgetEntity(cats, 'item', id)
    if (cats !== store().categories) store().setCategories(cats)
  })
}
