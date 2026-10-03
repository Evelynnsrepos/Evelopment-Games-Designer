import { newId, type Enemy, type Id, type Item } from '@/core/model'
import { enemyStatsAtLevel } from '@/shared/calculators'

/**
 * Wave Planner (v0.7): plan the waves of a wave fighter. Each wave has a time
 * limit and groups of enemies; health and drop chances grow from wave to wave,
 * and the planner works out the damage per second needed to beat each wave and
 * which weapons can keep up.
 */

export type Growth = { mode: 'percent' | 'flat'; perWave: number }

export interface EnemyGroup {
  id: Id
  /** From the Enemy List; null = a custom enemy with `name` and `health`. */
  enemyId: Id | null
  name: string
  /** Health at wave 1 for custom enemies (Enemy List enemies use their health stat). */
  health: number
  countBase: number
  /** Extra enemies each wave (may be fractional; counts round down). */
  countPerWave: number
  fromWave: number
  /** null = until the last wave. */
  toWave: number | null
  /** Appears every N waves from `fromWave` (1 = every wave; 5 = a boss every fifth wave). */
  every: number
}

export interface WaveDoc {
  waves: number
  /** Seconds the player has for wave 1, and how much more (or less) each wave gives. */
  timeBase: number
  timePerWave: number
  /** How enemy health grows per wave. `level` uses each Enemy List enemy's own growth, with wave = level. */
  healthGrowth: Growth | { mode: 'level' }
  /** Name of the enemy stat that holds health. */
  healthStat: string
  /** Drop chance multiplier growth per wave, in percent (e.g. 5 = +5% per wave). */
  dropGrowthPercent: number
  groups: EnemyGroup[]
  /** Item stat that holds a weapon's damage per second, and the weapons to compare. */
  weaponStat: string
  weaponIds: Id[]
}

export const MAX_WAVES = 500

export const createWaveDoc = (): WaveDoc => ({
  waves: 20,
  timeBase: 30,
  timePerWave: 2,
  healthGrowth: { mode: 'percent', perWave: 10 },
  healthStat: 'HP',
  dropGrowthPercent: 0,
  groups: [],
  weaponStat: 'DPS',
  weaponIds: [],
})

export function newGroup(enemy?: Enemy): EnemyGroup {
  return {
    id: newId(),
    enemyId: enemy?.id ?? null,
    name: enemy ? '' : 'Enemy',
    health: 100,
    countBase: 5,
    countPerWave: 1,
    fromWave: 1,
    toWave: null,
    every: 1,
  }
}

/** Old or partial documents filled up with defaults. */
export function normalizeWaveDoc(d: Partial<WaveDoc> | null | undefined): WaveDoc {
  return { ...createWaveDoc(), ...d, groups: (d?.groups ?? []).map((g) => ({ ...newGroup(), ...g })) }
}

/** Case-insensitive stat lookup, so "hp", "HP" and "Health" all work. */
export function statValue(stats: Record<string, number>, name: string): number | undefined {
  if (name in stats) return stats[name]
  const key = Object.keys(stats).find((k) => k.toLowerCase() === name.trim().toLowerCase())
  return key === undefined ? undefined : stats[key]
}

export interface GroupInWave {
  group: EnemyGroup
  name: string
  count: number
  /** Health of one enemy in this wave. */
  health: number
  /** The enemy's base health could not be found (no health stat). */
  missingHealth: boolean
}

export interface ExpectedDrop {
  itemId: Id
  amount: number
}

export interface WaveRow {
  wave: number
  seconds: number
  groups: GroupInWave[]
  enemies: number
  totalHealth: number
  /** Damage per second needed to clear the wave in time; Infinity if there is no time. */
  dps: number
  /** Drop chance multiplier this wave (1 = as in the drop table). */
  dropMultiplier: number
  drops: ExpectedDrop[]
}

const appears = (g: EnemyGroup, wave: number) =>
  wave >= g.fromWave && (g.toWave === null || wave <= g.toWave) && (wave - g.fromWave) % Math.max(1, Math.floor(g.every)) === 0

export function computeWaves(doc: WaveDoc, enemies: Enemy[]): WaveRow[] {
  const byId = new Map(enemies.map((e) => [e.id, e]))
  const n = Math.max(0, Math.min(MAX_WAVES, Math.floor(doc.waves)))
  const rows: WaveRow[] = []
  for (let wave = 1; wave <= n; wave++) {
    const seconds = Math.max(0, doc.timeBase + doc.timePerWave * (wave - 1))
    const dropMultiplier = Math.max(0, 1 + (doc.dropGrowthPercent / 100) * (wave - 1))
    const groups: GroupInWave[] = []
    const drops = new Map<Id, number>()
    for (const g of doc.groups) {
      if (!appears(g, wave)) continue
      const count = Math.max(0, Math.floor(g.countBase + g.countPerWave * (wave - g.fromWave)))
      if (count === 0) continue
      const enemy = g.enemyId ? byId.get(g.enemyId) : undefined
      let base = g.health
      let missingHealth = false
      if (g.enemyId) {
        const found = enemy && statValue(doc.healthGrowth.mode === 'level' ? enemyStatsAtLevel(enemy, wave) : enemy.stats, doc.healthStat)
        missingHealth = found === undefined
        base = found ?? 0
      }
      let health = base
      if (doc.healthGrowth.mode === 'percent') health = base * Math.pow(1 + doc.healthGrowth.perWave / 100, wave - 1)
      else if (doc.healthGrowth.mode === 'flat') health = base + doc.healthGrowth.perWave * (wave - 1)
      groups.push({ group: g, name: enemy?.name || g.name || 'Enemy', count, health: Math.max(0, health), missingHealth })
      for (const d of enemy?.dropTable ?? []) {
        const chance = Math.min(1, (d.chancePercent / 100) * dropMultiplier)
        const amount = (Math.max(0, d.amountMin) + Math.max(d.amountMin, d.amountMax)) / 2
        drops.set(d.itemId, (drops.get(d.itemId) ?? 0) + count * chance * amount)
      }
    }
    const totalHealth = groups.reduce((s, x) => s + x.count * x.health, 0)
    rows.push({
      wave,
      seconds,
      groups,
      enemies: groups.reduce((s, x) => s + x.count, 0),
      totalHealth,
      dps: totalHealth === 0 ? 0 : seconds > 0 ? totalHealth / seconds : Infinity,
      dropMultiplier,
      drops: [...drops].map(([itemId, amount]) => ({ itemId, amount })),
    })
  }
  return rows
}

export interface WeaponReach {
  item: Item
  dps: number | undefined
  /** Last wave in a row from wave 1 the weapon clears in time; 0 = not even wave 1. */
  lastWave: number
}

/** How far each weapon gets: waves are cleared while its DPS is at least what the wave needs. */
export function weaponReach(rows: WaveRow[], items: Item[], stat: string): WeaponReach[] {
  return items.map((item) => {
    const dps = statValue(item.stats, stat)
    let lastWave = 0
    if (dps !== undefined) for (const r of rows) {
      if (r.dps > dps) break
      lastWave = r.wave
    }
    return { item, dps, lastWave }
  })
}
