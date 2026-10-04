import type { Entity, Id } from '@/core/model'

/**
 * Entry history (v0.10): snapshots of items, characters, towns and enemies as
 * they change, so old versions can be compared and restored. Stored on this
 * computer only (not shared when working together).
 */

export interface Snapshot {
  at: string
  data: Entity
}

export interface HistoryDoc {
  entries: Record<Id, Snapshot[]>
}

export const HISTORY_DOC = { type: 'history' as const, id: 'entries' }
export const createHistoryDoc = (): HistoryDoc => ({ entries: {} })

/** Edits closer together than this become one version. */
export const MERGE_MS = 2 * 60 * 1000
export const MAX_VERSIONS = 40

/** Add a version of an entity. `before` is its state before this change, kept as the first version. */
export function addSnapshot(h: HistoryDoc, entity: Entity, now: Date, before?: Entity): HistoryDoc {
  let list = h.entries[entity.id] ?? []
  if (!list.length && before) list = [{ at: new Date(now.getTime() - 1).toISOString(), data: before }]
  const last = list[list.length - 1]
  const snap = { at: now.toISOString(), data: entity }
  if (last && list.length > 1 && now.getTime() - new Date(last.at).getTime() < MERGE_MS) list = [...list.slice(0, -1), snap]
  else list = [...list, snap]
  if (list.length > MAX_VERSIONS) list = list.slice(list.length - MAX_VERSIONS)
  return { entries: { ...h.entries, [entity.id]: list } }
}

export interface Change {
  field: string
  before: string
  after: string
}

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** What changed between two versions, field by field (stats and categories one by one). */
export function diff(a: Entity, b: Entity, categoryName: (id: Id) => string = (id) => id): Change[] {
  const out: Change[] = []
  const skip = new Set(['id', 'type', 'createdAt', 'updatedAt'])
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if (skip.has(k)) continue
    const va = (a as unknown as Record<string, unknown>)[k]
    const vb = (b as unknown as Record<string, unknown>)[k]
    if ((k === 'stats' || k === 'categories' || k === 'resistances') && typeof va === 'object' && typeof vb === 'object') {
      const ra = (va ?? {}) as Record<string, unknown>
      const rb = (vb ?? {}) as Record<string, unknown>
      for (const s of new Set([...Object.keys(ra), ...Object.keys(rb)]))
        if (show(ra[s]) !== show(rb[s])) out.push({ field: k === 'categories' ? categoryName(s) : `${k === 'stats' ? '' : `${k} `}${s}`, before: show(ra[s]), after: show(rb[s]) })
      continue
    }
    if (show(va) !== show(vb)) out.push({ field: k, before: show(va), after: show(vb) })
  }
  return out
}
