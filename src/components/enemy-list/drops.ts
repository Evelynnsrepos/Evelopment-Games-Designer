import { categoryAppliesTo, type Category, type DropRow, type Enemy, type Item, type StatBlock } from '@/core/model'
import { formatValue } from '@/shared/categories'
import { formatStat } from '@/shared/entityList'

/** Keep a drop row valid (EN-4): amounts are whole and non-negative, max ≥ min, chance 0–100. */
export function normalizeDrop(row: DropRow): DropRow {
  const whole = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0)
  const amountMin = whole(row.amountMin)
  const amountMax = Math.max(amountMin, whole(row.amountMax))
  const chance = Number.isFinite(row.chancePercent) ? Math.min(100, Math.max(0, row.chancePercent)) : 0
  return { ...row, amountMin, amountMax, chancePercent: chance }
}

/** "2" or "1–3" */
export function formatAmount(row: Pick<DropRow, 'amountMin' | 'amountMax'>): string {
  return row.amountMin === row.amountMax ? `${row.amountMin}` : `${row.amountMin}–${row.amountMax}`
}

/** Average number dropped per defeat: mean amount × chance. Used by the Resource Calculator (RC-6). */
export function expectedPerDefeat(row: Pick<DropRow, 'amountMin' | 'amountMax' | 'chancePercent'>): number {
  return ((row.amountMin + row.amountMax) / 2) * (row.chancePercent / 100)
}

/** Name for a drop row's item, or a clear marker when the item was deleted. */
export function dropItemName(row: DropRow, items: Item[]): string {
  if (!row.itemId) return 'No item chosen'
  const item = items.find((i) => i.id === row.itemId)
  return item ? item.name || 'Untitled item' : 'Missing item'
}

/** How a damage multiplier reads in words (1 = neutral). */
export function resistanceLabel(multiplier: number): string {
  if (multiplier === 0) return 'Immune'
  if (multiplier < 0) return 'Heals'
  if (multiplier < 1) return 'Resists'
  if (multiplier > 1) return 'Weak'
  return 'Normal'
}

/** "Lv 3" or "Lv 3–5" */
export function levelText(enemy: Pick<Enemy, 'levelMin' | 'levelMax'>): string {
  return enemy.levelMin === enemy.levelMax ? `Lv ${enemy.levelMin}` : `Lv ${enemy.levelMin}–${enemy.levelMax}`
}

/** Numbers the list can sort and filter by (EN-7): Level (the minimum) plus every combat stat. */
export function enemySortStats(enemy: Enemy): StatBlock {
  return { Level: enemy.levelMin, ...enemy.stats }
}

/** Short stat summary for cards, e.g. "HP 100 · ATK 10". */
export function statSummary(stats: StatBlock, max = 3): string {
  return Object.entries(stats)
    .slice(0, max)
    .map(([k, v]) => `${k} ${formatStat(v)}`)
    .join(' · ')
}

/**
 * Element names to offer for resistances: options or values of any "Element"
 * category, plus resistance names already used on any enemy.
 */
export function elementSuggestions(categories: Category[], enemies: Enemy[]): string[] {
  const names = new Set<string>()
  for (const c of categories) {
    if (c.name.trim().toLowerCase() !== 'element') continue
    c.options.forEach((o) => names.add(o))
    for (const e of enemies) {
      if (!categoryAppliesTo(c, 'enemy', e.id)) continue
      const v = formatValue(c, e.categories[c.id])
      if (v && c.kind !== 'boolean' && c.kind !== 'number') names.add(v)
    }
  }
  for (const e of enemies) Object.keys(e.resistances ?? {}).forEach((k) => names.add(k))
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** Rename a key in a record while keeping its order; null if the new name is empty or taken. */
export function renameKey<V>(record: Record<string, V>, from: string, to: string): Record<string, V> | null {
  const name = to.trim()
  if (!name) return null
  if (name === from) return record
  if (Object.hasOwn(record, name)) return null
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k === from ? name : k, v]))
}

/** A free key like "Fire", "Fire 2"… */
export function nextKey(record: Record<string, unknown>, base: string): string {
  if (!Object.hasOwn(record, base)) return base
  let i = 2
  while (Object.hasOwn(record, `${base} ${i}`)) i++
  return `${base} ${i}`
}
