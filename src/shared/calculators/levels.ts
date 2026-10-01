import type { Enemy, Id, StatBlock, StatGrowth } from '@/core/model'
import { compile, getFormula, type CompiledFormula } from '@/shared/formulas'
import type { CostRow, GrowthRow, LevelPresetDoc } from './docs'

/** Levels in a preset's range, clamped so a typo like 1 to 100000 cannot freeze the app. */
export const MAX_LEVEL_ROWS = 1000

export function levelRange(doc: Pick<LevelPresetDoc, 'levelFrom' | 'levelTo'>): number[] {
  const from = Math.max(1, Math.floor(doc.levelFrom || 1))
  const to = Math.max(from, Math.min(from + MAX_LEVEL_ROWS - 1, Math.floor(doc.levelTo || from)))
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

/**
 * Stat growth per level, the same rule the Enemy List uses (EN-3): `base` is the level 1 value.
 * flat: base + perLevel × (level − 1); percent: base × (1 + perLevel%)^(level − 1).
 */
export function statAtLevel(base: number, growth: Pick<StatGrowth, 'mode' | 'perLevel'> | undefined, level: number): number {
  if (!growth) return base
  const steps = Math.max(0, level - 1)
  return growth.mode === 'percent' ? base * (1 + growth.perLevel / 100) ** steps : base + growth.perLevel * steps
}

/** Every stat of an enemy at a level. Enemy stats are stored as their level 1 values. */
export function enemyStatsAtLevel(enemy: Pick<Enemy, 'stats' | 'growth'>, level: number): StatBlock {
  const out: StatBlock = {}
  for (const [name, base] of Object.entries(enemy.stats ?? {})) {
    out[name] = statAtLevel(base, (enemy.growth ?? []).find((g) => g.stat === name), level)
  }
  return out
}

const compiled = new Map<string, CompiledFormula | Error>()
function cachedCompile(source: string): CompiledFormula {
  let c = compiled.get(source)
  if (!c) {
    try {
      c = compile(source)
    } catch (e) {
      c = e instanceof Error ? e : new Error(String(e))
    }
    if (compiled.size > 500) compiled.clear()
    compiled.set(source, c)
  }
  if (c instanceof Error) throw c
  return c
}

/**
 * The value of a growth row at a level (LV-3). A formula row can use `Level` and `Base`.
 * Throws `FormulaError` for a broken formula; use `tryGrowthValue` to get null instead.
 */
export function growthValue(row: Pick<GrowthRow, 'base' | 'mode' | 'perLevel' | 'expression'>, level: number): number {
  if (row.mode === 'formula') return cachedCompile(row.expression).evaluate({ Level: level, Base: row.base })
  return statAtLevel(row.base, { mode: row.mode, perLevel: row.perLevel }, level)
}

export function tryGrowthValue(row: Pick<GrowthRow, 'base' | 'mode' | 'perLevel' | 'expression'>, level: number): number | null {
  try {
    return growthValue(row, level)
  } catch {
    return null
  }
}

/** Grown stats by name at a level. Rows without a name or with a broken formula are skipped. */
export function statsAtLevel(rows: readonly GrowthRow[], level: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const name = r.stat.trim()
    if (!name) continue
    const v = tryGrowthValue(r, level)
    if (v !== null) out[name] = v
  }
  return out
}

/** The XP formula of a preset (LV-1): a library curve, or a custom formula. */
export function xpExpression(xp: LevelPresetDoc['xp']): string {
  if (xp.formulaId === null) return xp.expression
  return getFormula(xp.formulaId)?.expression ?? ''
}

export interface XpRow {
  level: number
  /** XP needed to go from this level to the next. */
  toNext: number | null
  /** Total XP needed to reach this level from the first level of the range (LV-2). */
  total: number | null
}

/** XP table across the preset's level range (LV-2). A failing level makes later totals null. */
export function xpTable(doc: Pick<LevelPresetDoc, 'levelFrom' | 'levelTo' | 'xp'>): XpRow[] {
  const levels = levelRange(doc)
  let f: CompiledFormula | null = null
  try {
    f = cachedCompile(xpExpression(doc.xp))
  } catch {
    f = null
  }
  let total: number | null = 0
  return levels.map((level) => {
    let toNext: number | null = null
    if (f) {
      try {
        toNext = f.evaluate({ ...doc.xp.values, Level: level })
      } catch {
        toNext = null
      }
    }
    const row = { level, toNext, total }
    total = total === null || toNext === null ? null : total + toNext
    return row
  })
}

/** Amount of one material needed to go from `level` to `level + 1`, rounded to whole items, never negative. */
export function costAtLevel(row: CostRow, level: number): number | null {
  const v = tryGrowthValue(row, level)
  return v === null ? null : Math.max(0, Math.round(v))
}

/**
 * Total materials needed to level from `from` to `to` (LV-6, RC-3): the sum of every level-up on the way,
 * by item id. Rows with no item are left out. Broken formulas are reported in `errors`.
 */
export function levelUpCosts(costs: readonly CostRow[], from: number, to: number): { totals: Map<Id, number>; errors: string[] } {
  const totals = new Map<Id, number>()
  const errors: string[] = []
  const start = Math.max(1, Math.floor(from))
  const end = Math.min(start + MAX_LEVEL_ROWS, Math.floor(to))
  for (const row of costs) {
    if (!row.itemId) continue
    let sum = 0
    for (let level = start; level < end; level++) {
      const v = costAtLevel(row, level)
      if (v === null) {
        errors.push(row.id)
        sum = NaN
        break
      }
      sum += v
    }
    if (Number.isNaN(sum)) continue
    totals.set(row.itemId, (totals.get(row.itemId) ?? 0) + sum)
  }
  return { totals, errors }
}
