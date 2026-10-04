import { useCallback } from 'react'
import type { ComponentType, Id } from '@/core/model'
import { useDocument } from '@/core/state'

/** A document holding one list (`items`), with add, edit and remove, all undoable and synced. */
export function useItems<T extends { id: Id }, D extends { items: T[] } = { items: T[] }>(type: ComponentType, id: Id, create: () => D) {
  const doc = useDocument<D>(type, id, create)
  const items = doc.data?.items ?? []
  const add = useCallback((item: T) => doc.update((d) => ({ ...d, items: [...(d?.items ?? []), item] })), [doc])
  const edit = useCallback((itemId: Id, patch: Partial<T>) => doc.update((d) => ({ ...d, items: d.items.map((x) => (x.id === itemId ? { ...x, ...patch } : x)) })), [doc])
  const remove = useCallback((itemId: Id) => doc.update((d) => ({ ...d, items: d.items.filter((x) => x.id !== itemId) })), [doc])
  return { doc, items, add, edit, remove, loaded: !!doc.data }
}
