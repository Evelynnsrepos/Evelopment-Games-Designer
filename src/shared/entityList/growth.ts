import type { Enemy, StatBlock, StatGrowth } from '@/core/model'

/**
 * Stat growth per level (EN-3), matching the Level Calculator's formulas (LV-3):
 * - flat:    Base + PerLevel × (Level − 1)            (library "stat-flat")
 * - percent: Base × (1 + PerLevel% ) ^ (Level − 1)     (library "stat-percent", compounding)
 * `base` is the value at level 1.
 */
export function statAtLevel(base: number, growth: Pick<StatGrowth, 'mode' | 'perLevel'> | undefined, level: number): number {
  if (!growth) return base
  const steps = Math.max(0, level - 1)
  return growth.mode === 'percent' ? base * (1 + growth.perLevel / 100) ** steps : base + growth.perLevel * steps
}

/** Every stat of an enemy at a level. Stats are stored as their level 1 values. */
export function enemyStatsAtLevel(enemy: Pick<Enemy, 'stats' | 'growth'>, level: number): StatBlock {
  const out: StatBlock = {}
  for (const [name, base] of Object.entries(enemy.stats ?? {})) {
    out[name] = statAtLevel(base, (enemy.growth ?? []).find((g) => g.stat === name), level)
  }
  return out
}

/** Round for display: whole numbers stay whole, others get up to 2 decimals. */
export function formatStat(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}
