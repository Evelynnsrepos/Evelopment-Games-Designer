import { categoryAppliesTo, type Category, type EntityBase, type EntityType, type Id, type StatBlock } from '@/core/model'
import { compareValues, formatValue, matchesFilter, type CategoryFilter } from '@/shared/categories'

/** Sort by a built-in field, a category (`cat:<id>`) or a stat (`stat:<name>`). */
export type SortKey = 'name' | 'createdAt' | 'updatedAt' | `cat:${string}` | `stat:${string}`

/** Keep entities whose stat lies in [min, max]; a null bound is open (EN-7). */
export interface StatFilter {
  stat: string
  min: number | null
  max: number | null
}

export interface EntityQuery {
  search: string
  filter: CategoryFilter | null
  stat: StatFilter | null
  sort: SortKey
  desc: boolean
}

export const DEFAULT_QUERY: EntityQuery = { search: '', filter: null, stat: null, sort: 'name', desc: false }

export interface QueryOptions<E> {
  /** Numbers to sort and filter by, e.g. enemy combat stats. */
  stats?(entity: E): StatBlock
  /** Extra searchable text, e.g. link labels or drop item names. */
  searchText?(entity: E): string[]
}

const byName = (a: EntityBase, b: EntityBase) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })

function haystack<E extends EntityBase>(entity: E, type: EntityType, categories: Category[], opts: QueryOptions<E>): string {
  const values = categories.filter((c) => categoryAppliesTo(c, type, entity.id)).map((c) => formatValue(c, entity.categories[c.id]))
  const stats = opts.stats ? Object.keys(opts.stats(entity)) : []
  return [entity.name, entity.description, entity.notes, ...values, ...stats, ...(opts.searchText?.(entity) ?? [])].join('\n').toLowerCase()
}

const statOf = <E>(opts: QueryOptions<E>, e: E, name: string): number | null => {
  const v = opts.stats?.(e)[name]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Search, filter and sort entities for display (IT-8, CH-6, EN-7). Never mutates the input. */
export function queryEntities<E extends EntityBase>(list: E[], type: EntityType, categories: Category[], q: EntityQuery, opts: QueryOptions<E> = {}): E[] {
  const words = q.search.toLowerCase().split(/\s+/).filter(Boolean)
  let out = list.filter((e) => matchesFilter(categories, type, e, q.filter))
  if (q.stat) {
    const { stat, min, max } = q.stat
    out = out.filter((e) => {
      const v = statOf(opts, e, stat)
      return v !== null && (min === null || v >= min) && (max === null || v <= max)
    })
  }
  if (words.length)
    out = out.filter((e) => {
      const h = haystack(e, type, categories, opts)
      return words.every((w) => h.includes(w))
    })

  // Category and stat sorts keep empty values last in both directions.
  const emptyLast = (value: (e: E) => unknown, isEmpty: (v: unknown) => boolean, compare: (a: unknown, b: unknown) => number) =>
    [...out].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      const ea = isEmpty(va)
      const eb = isEmpty(vb)
      if (ea || eb) return ea === eb ? byName(a, b) : ea ? 1 : -1
      const c = compare(va, vb)
      return (q.desc ? -c : c) || byName(a, b)
    })

  if (q.sort.startsWith('cat:')) {
    const category = categories.find((c) => c.id === q.sort.slice(4))
    if (category) {
      return emptyLast(
        (e) => (categoryAppliesTo(category, type, e.id) ? e.categories[category.id] : null),
        (v) => formatValue(category, v as never) === '',
        (a, b) => compareValues(category, a as never, b as never),
      )
    }
  } else if (q.sort.startsWith('stat:')) {
    const name = q.sort.slice(5)
    return emptyLast(
      (e) => statOf(opts, e, name),
      (v) => v === null,
      (a, b) => (a as number) - (b as number),
    )
  }

  let cmp: (a: E, b: E) => number = byName
  if (q.sort === 'createdAt' || q.sort === 'updatedAt') {
    const key = q.sort
    cmp = (a, b) => a[key].localeCompare(b[key]) || byName(a, b)
  }
  const sorted = [...out].sort(cmp)
  return q.desc ? sorted.reverse() : sorted
}

/** Ids from `ordered` between two ids inclusive, for shift-click range selection. */
export function rangeBetween(ordered: Id[], from: Id, to: Id): Id[] {
  const a = ordered.indexOf(from)
  const b = ordered.indexOf(to)
  if (a < 0 || b < 0) return [to]
  return ordered.slice(Math.min(a, b), Math.max(a, b) + 1)
}

/** Rename a stat key while keeping its position; returns null if the new name is empty or taken. */
export function renameStat(stats: StatBlock, from: string, to: string): StatBlock | null {
  const name = to.trim()
  if (!name) return null
  if (name === from) return stats
  if (Object.hasOwn(stats, name)) return null
  return Object.fromEntries(Object.entries(stats).map(([k, v]) => [k === from ? name : k, v]))
}

/** A free stat name like "Stat", "Stat 2", ... */
export function nextStatName(stats: StatBlock, base = 'Stat'): string {
  if (!Object.hasOwn(stats, base)) return base
  let i = 2
  while (Object.hasOwn(stats, `${base} ${i}`)) i++
  return `${base} ${i}`
}
