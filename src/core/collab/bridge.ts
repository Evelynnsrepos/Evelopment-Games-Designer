import { generateNKeysBetween } from 'fractional-indexing'
import * as Y from 'yjs'

/**
 * Two-way bridge between the app's immutable JSON snapshots and Yjs, so the
 * stores keep their `update(recipe)` API and every tool syncs without changes.
 *
 * Mapping:
 * - plain objects become `Y.Map`s, field by field (two people editing
 *   different fields both win; the same field: last writer wins)
 * - arrays whose items all have a unique string `id` (entities, canvas nodes,
 *   drop rows, ...) become a keyed `Y.Map` marked with `LIST`, each item
 *   carrying a fractional `ORDER` key, so concurrent inserts, deletes and
 *   reorders merge instead of overwriting the whole array
 * - everything else (strings, numbers, arrays of numbers or strings) is stored
 *   as one value
 */
export const LIST = '__list'
export const ORDER = '__o'

type Obj = Record<string, unknown>

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Arrays merged item by item: every item is an object with a unique string id. Empty arrays count. */
export function isKeyedList(value: unknown): value is Obj[] {
  if (!Array.isArray(value)) return false
  const seen = new Set<string>()
  for (const item of value) {
    if (!isObject(item) || typeof item.id !== 'string' || seen.has(item.id)) return false
    seen.add(item.id)
  }
  return true
}

export function toY(value: unknown): unknown {
  if (isKeyedList(value)) {
    const map = new Y.Map<unknown>()
    map.set(LIST, 1)
    const keys = generateNKeysBetween(null, null, value.length)
    value.forEach((item, i) => {
      const y = toY(item) as Y.Map<unknown>
      y.set(ORDER, keys[i])
      map.set(item.id as string, y)
    })
    return map
  }
  if (isObject(value)) {
    const map = new Y.Map<unknown>()
    for (const [k, v] of Object.entries(value)) if (v !== undefined) map.set(k, toY(v))
    return map
  }
  return value
}

// ---------------------------------------------------------------------------
// Reading, with a cache so unchanged parts keep their object identity
// (React memo and the store's structural sharing keep working).

// oxlint-disable-next-line no-explicit-any -- Yjs types are invariant in their event type
const cache = new WeakMap<Y.AbstractType<any>, unknown>()

/** Forget cached JSON for every type a transaction touched, and their parents. */
export function invalidate(transaction: Y.Transaction) {
  for (const type of transaction.changed.keys()) {
    let t: Y.AbstractType<any> | null = type
    while (t) {
      cache.delete(t)
      t = (t._item?.parent as Y.AbstractType<any> | undefined) ?? null
    }
  }
}

export function fromY(value: unknown): unknown {
  if (!(value instanceof Y.Map)) return value
  const hit = cache.get(value)
  if (hit !== undefined) return hit
  let out: unknown
  if (value.has(LIST)) {
    const items: { order: string; id: string; json: unknown }[] = []
    value.forEach((v, k) => {
      if (k === LIST || !(v instanceof Y.Map)) return
      items.push({ order: String(v.get(ORDER) ?? ''), id: k, json: fromY(v) })
    })
    items.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    out = items.map((i) => i.json)
  } else {
    const obj: Obj = {}
    value.forEach((v, k) => {
      if (k !== ORDER) obj[k] = fromY(v)
    })
    out = obj
  }
  cache.set(value, out)
  return out
}

// ---------------------------------------------------------------------------
// Writing: apply the smallest change that turns `prev` into `next`.
// `prev` must be the JSON currently in Yjs (or undefined if unknown); equal
// references are skipped, which keeps big documents fast.

export function syncMap(map: Y.Map<unknown>, prev: unknown, next: Obj) {
  const before = isObject(prev) ? prev : undefined
  for (const key of [...map.keys()]) {
    if (key === ORDER || key === LIST) continue
    if (next[key] === undefined) map.delete(key)
  }
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue
    syncValue(map, key, before ? before[key] : undefined, value, before !== undefined && key in before)
  }
}

function syncValue(parent: Y.Map<unknown>, key: string, prev: unknown, next: unknown, prevKnown: boolean) {
  if (prevKnown && prev === next && parent.has(key)) return
  const current = parent.get(key)
  if (current instanceof Y.Map) {
    if (isKeyedList(next) && current.has(LIST)) return syncList(current, prev, next)
    if (isObject(next) && !current.has(LIST)) return syncMap(current, prev, next)
  } else if (current !== undefined && !(current instanceof Y.AbstractType) && !isKeyedList(next) && !isObject(next)) {
    if (deepEqual(current, next)) return
  }
  parent.set(key, toY(next))
}

export function syncList(map: Y.Map<unknown>, prev: unknown, next: Obj[]) {
  if (!map.has(LIST)) map.set(LIST, 1)
  const prevById = new Map<string, Obj>()
  if (Array.isArray(prev)) for (const p of prev) if (isObject(p) && typeof p.id === 'string') prevById.set(p.id, p)

  const ids = new Set(next.map((n) => n.id as string))
  for (const key of [...map.keys()]) if (key !== LIST && !ids.has(key)) map.delete(key)

  const items: Y.Map<unknown>[] = []
  for (const item of next) {
    const id = item.id as string
    let y = map.get(id)
    if (y instanceof Y.Map) {
      const p = prevById.get(id)
      if (p !== item) syncMap(y, p, item)
    } else {
      y = toY(item) as Y.Map<unknown>
      map.set(id, y)
    }
    items.push(y as Y.Map<unknown>)
  }
  reorder(items, next.map((n) => n.id as string))
}

/** Give items increasing ORDER keys, keeping as many existing keys as possible (longest increasing run). */
function reorder(items: Y.Map<unknown>[], ids: string[]) {
  const keys = items.map((y) => y.get(ORDER) as string | undefined)
  const less = (i: number, j: number) => keys[i]! < keys[j]! || (keys[i] === keys[j] && ids[i] < ids[j])
  const keep = longestIncreasing(keys.map((k, i) => (k === undefined ? -1 : i)).filter((i) => i >= 0), less)
  if (keep.size === items.length) return

  let i = 0
  while (i < items.length) {
    if (keep.has(i)) {
      i++
      continue
    }
    let j = i
    while (j < items.length && !keep.has(j)) j++
    const low = i > 0 ? keys[i - 1]! : null
    const high = j < items.length ? keys[j]! : null
    let fresh: string[]
    try {
      fresh = generateNKeysBetween(low, high, j - i)
    } catch {
      // Two kept neighbours share a key (concurrent inserts): renumber everything.
      generateNKeysBetween(null, null, items.length).forEach((k, n) => items[n].set(ORDER, k))
      return
    }
    for (let n = i; n < j; n++) {
      keys[n] = fresh[n - i]
      items[n].set(ORDER, fresh[n - i])
    }
    i = j
  }
}

function longestIncreasing(indices: number[], less: (a: number, b: number) => boolean): Set<number> {
  const tails: number[] = []
  const prevOf = new Map<number, number>()
  for (const idx of indices) {
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (less(tails[mid], idx)) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) prevOf.set(idx, tails[lo - 1])
    tails[lo] = idx
  }
  const out = new Set<number>()
  let cur = tails.length ? tails[tails.length - 1] : undefined
  while (cur !== undefined) {
    out.add(cur)
    cur = prevOf.get(cur)
  }
  return out
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  if (Array.isArray(b)) return false
  const ka = Object.keys(a as Obj).filter((k) => (a as Obj)[k] !== undefined)
  const kb = Object.keys(b as Obj).filter((k) => (b as Obj)[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => deepEqual((a as Obj)[k], (b as Obj)[k]))
}

// ---------------------------------------------------------------------------
// Top-level documents. Each store document is its own top-level Y.Map, so two
// peers creating the same document offline still merge field by field.

/** JSON of a top-level document, or undefined if nobody has written it yet. */
export function readTop(doc: Y.Doc, name: string): unknown {
  if (!doc.share.has(name)) return undefined
  const map = doc.getMap<unknown>(name)
  if (map.size === 0) return undefined
  return fromY(map)
}

export function writeTop(doc: Y.Doc, name: string, prev: unknown, next: unknown) {
  const map = doc.getMap<unknown>(name)
  if (Array.isArray(next)) {
    if (!isKeyedList(next)) throw new Error(`Top-level list ${name} needs unique ids`)
    syncList(map, map.size ? prev : undefined, next)
  } else if (isObject(next)) {
    syncMap(map, map.size ? prev : undefined, next)
  } else {
    throw new Error(`Document ${name} must be an object or a list`)
  }
}
