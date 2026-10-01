import { categoryAppliesTo, type Category, type Enemy, type Id, type Item } from '@/core/model'
import { compareValues, formatValue, matchesFilter, type CategoryFilter } from '@/shared/categories'

/** Sort by a built-in field or by a category (`cat:<id>`). */
export type SortKey = 'name' | 'createdAt' | 'updatedAt' | `cat:${string}`

export interface ItemQuery {
  search: string
  filter: CategoryFilter | null
  sort: SortKey
  desc: boolean
}

export const DEFAULT_QUERY: ItemQuery = { search: '', filter: null, sort: 'name', desc: false }

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })

/** Search text: name, description, notes, stat names and shown category values (IT-8). */
function haystack(item: Item, categories: Category[]): string {
  const values = categories.filter((c) => categoryAppliesTo(c, 'item', item.id)).map((c) => formatValue(c, item.categories[c.id]))
  return [item.name, item.description, item.notes, ...Object.keys(item.stats), ...values].join('\n').toLowerCase()
}

/** Search, filter and sort items for display. Never mutates the input. */
export function queryItems(items: Item[], categories: Category[], q: ItemQuery): Item[] {
  const words = q.search.toLowerCase().split(/\s+/).filter(Boolean)
  let out = items.filter((it) => matchesFilter(categories, 'item', it, q.filter))
  if (words.length) out = out.filter((it) => {
    const h = haystack(it, categories)
    return words.every((w) => h.includes(w))
  })

  let cmp: (a: Item, b: Item) => number = byName
  if (q.sort === 'createdAt' || q.sort === 'updatedAt') {
    const key = q.sort
    cmp = (a, b) => a[key].localeCompare(b[key]) || byName(a, b)
  } else if (q.sort.startsWith('cat:')) {
    const category = categories.find((c) => c.id === q.sort.slice(4))
    if (category) {
      // Items the category is not shown on behave like empty values: always last.
      const value = (it: Item) => (categoryAppliesTo(category, 'item', it.id) ? it.categories[category.id] : null)
      cmp = (a, b) => {
        const va = value(a)
        const vb = value(b)
        const emptyA = formatValue(category, va) === ''
        const emptyB = formatValue(category, vb) === ''
        if (emptyA || emptyB) return emptyA === emptyB ? byName(a, b) : emptyA ? 1 : -1
        const c = compareValues(category, va, vb)
        return (q.desc ? -c : c) || byName(a, b)
      }
      return [...out].sort(cmp)
    }
  }
  const sorted = [...out].sort(cmp)
  return q.desc ? sorted.reverse() : sorted
}

export interface DropSource {
  enemyId: Id
  enemyName: string
  amountMin: number
  amountMax: number
  chancePercent: number
}

/** Enemies whose drop tables include this item (IT-9, EN-4). */
export function droppedBy(itemId: Id, enemies: Enemy[]): DropSource[] {
  const out: DropSource[] = []
  for (const e of enemies) {
    for (const row of e.dropTable ?? []) {
      if (row.itemId !== itemId) continue
      out.push({ enemyId: e.id, enemyName: e.name, amountMin: row.amountMin, amountMax: row.amountMax, chancePercent: row.chancePercent })
    }
  }
  return out.sort((a, b) => a.enemyName.localeCompare(b.enemyName))
}

export function formatDrop(d: DropSource): string {
  const amount = d.amountMin === d.amountMax ? `${d.amountMin}` : `${d.amountMin}–${d.amountMax}`
  return `${amount} × ${d.chancePercent}%`
}

/** Ids from `ordered` between two ids inclusive, for shift-click range selection. */
export function rangeBetween(ordered: Id[], from: Id, to: Id): Id[] {
  const a = ordered.indexOf(from)
  const b = ordered.indexOf(to)
  if (a < 0 || b < 0) return [to]
  return ordered.slice(Math.min(a, b), Math.max(a, b) + 1)
}

/** Rename a stat key while keeping its position; returns null if the new name is empty or taken. */
export function renameStat(stats: Record<string, number>, from: string, to: string): Record<string, number> | null {
  const name = to.trim()
  if (!name) return null
  if (name === from) return stats
  if (Object.hasOwn(stats, name)) return null
  return Object.fromEntries(Object.entries(stats).map(([k, v]) => [k === from ? name : k, v]))
}

/** A free stat name like "Stat", "Stat 2", ... */
export function nextStatName(stats: Record<string, number>, base = 'Stat'): string {
  if (!Object.hasOwn(stats, base)) return base
  let i = 2
  while (Object.hasOwn(stats, `${base} ${i}`)) i++
  return `${base} ${i}`
}
