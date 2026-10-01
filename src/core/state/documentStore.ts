import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import type { ComponentType, Id } from '../model'
import { readDocument, writeDocument } from '../project'
import { flush, scheduleSave } from './autosave'
import { History } from './history'
import { useProjectStore } from './projectStore'

/**
 * Component documents (`components/<type>/<id>.json`), loaded on demand and
 * cached in memory. Use `useDocument` from a component; it gives you the
 * data, an `update` that auto-saves, and per-document undo/redo.
 */
interface DocState {
  docs: Record<string, unknown>
}

const useDocs = create<DocState>()(() => ({ docs: {} }))
const histories = new Map<string, History<unknown>>()
const loading = new Map<string, Promise<void>>()

const keyOf = (root: string, type: ComponentType, id: Id) => `${root}|${type}/${id}`

function historyFor(key: string) {
  let h = histories.get(key)
  if (!h) histories.set(key, (h = new History()))
  return h
}

async function ensureLoaded<T>(root: string, type: ComponentType, id: Id, createDefault: () => T) {
  const key = keyOf(root, type, id)
  if (key in useDocs.getState().docs) return
  if (!loading.has(key)) {
    loading.set(
      key,
      readDocument(root, type, id, createDefault).then((data) => {
        useDocs.setState((s) => ({ docs: { ...s.docs, [key]: data } }))
        loading.delete(key)
      }),
    )
  }
  await loading.get(key)
}

function setDoc(root: string, type: ComponentType, id: Id, data: unknown) {
  const key = keyOf(root, type, id)
  useDocs.setState((s) => ({ docs: { ...s.docs, [key]: data } }))
  scheduleSave(key, () => writeDocument(root, type, id, useDocs.getState().docs[key]))
}

export interface UseDocumentResult<T> {
  /** undefined while loading. */
  data: T | undefined
  /** Apply a change. Pass `{ undoable: false }` for transient changes such as a drag in progress. */
  update(recipe: (current: T) => T, options?: { undoable?: boolean }): void
  undo(): void
  redo(): void
  canUndo: boolean
  canRedo: boolean
}

export function useDocument<T>(type: ComponentType, id: Id, createDefault: () => T): UseDocumentResult<T> {
  const root = useProjectStore((s) => s.root)
  const key = root ? keyOf(root, type, id) : ''
  const data = useDocs((s) => (key ? (s.docs[key] as T | undefined) : undefined))

  useEffect(() => {
    if (root) void ensureLoaded(root, type, id, createDefault)
    // createDefault is intentionally not a dependency; it only matters for the first load.
  }, [root, type, id])

  const update = useCallback(
    (recipe: (current: T) => T, options?: { undoable?: boolean }) => {
      if (!root) return
      const current = useDocs.getState().docs[key] as T | undefined
      if (current === undefined) return
      const next = recipe(current)
      if (next === current) return
      if (options?.undoable !== false) historyFor(key).record(current)
      setDoc(root, type, id, next)
    },
    [root, key, type, id],
  )

  const undo = useCallback(() => {
    if (!root) return
    const prev = historyFor(key).undo(useDocs.getState().docs[key])
    if (prev !== undefined) setDoc(root, type, id, prev)
  }, [root, key, type, id])

  const redo = useCallback(() => {
    if (!root) return
    const next = historyFor(key).redo(useDocs.getState().docs[key])
    if (next !== undefined) setDoc(root, type, id, next)
  }, [root, key, type, id])

  const h = key ? historyFor(key) : null
  return { data, update, undo, redo, canUndo: !!h?.canUndo, canRedo: !!h?.canRedo }
}

/** Save a document now (ED-8: closing a component saves it). */
export async function flushDocument(type: ComponentType, id: Id) {
  const root = useProjectStore.getState().root
  if (root) await flush(keyOf(root, type, id))
}

/** Drop cached documents when a project closes. */
export function clearDocumentCache() {
  useDocs.setState({ docs: {} })
  histories.clear()
}
