import type { Enemy, Id } from '@/core/model'
import { levelUpCosts, type LevelPresetDoc } from '@/shared/calculators'

/** A non-enemy source such as a chest, quest, shop or daily reward (RC-6). */
export interface OtherSource {
  id: Id
  name: string
  itemId: Id | null
  amountMin: number
  amountMax: number
  /** 0..100 */
  chancePercent: number
  secondsPerRun: number
  /** null = no daily limit. */
  runsPerDay: number | null
}

export interface ResourceDoc {
  goal: {
    /** level: materials to level something up with a Level Calculator preset (RC-3); amount: a fixed amount of one item. */
    mode: 'level' | 'amount'
    levelPresetId: Id | null
    /** null = the preset's own range. */
    fromLevel: number | null
    toLevel: number | null
    itemId: Id | null
    amount: number
  }
  otherSources: OtherSource[]
  /** Daily limits per enemy (e.g. a weekly boss = 1/7), by enemy id. Missing = no limit. */
  enemyRunsPerDay: Record<Id, number>
  /** Used for enemies without a time to defeat (EN-5). */
  defaultSecondsPerKill: number
  /** How long a player plays per day, to turn hours into days (RC-5). */
  hoursPerDay: number
}

export function createResourceDoc(): ResourceDoc {
  return {
    goal: { mode: 'level', levelPresetId: null, fromLevel: null, toLevel: null, itemId: null, amount: 100 },
    otherSources: [],
    enemyRunsPerDay: {},
    defaultSecondsPerKill: 60,
    hoursPerDay: 2,
  }
}

export function normalizeResourceDoc(d: Partial<ResourceDoc> | undefined): ResourceDoc {
  const def = createResourceDoc()
  if (!d) return def
  return {
    goal: { ...def.goal, ...d.goal },
    otherSources: d.otherSources ?? [],
    enemyRunsPerDay: d.enemyRunsPerDay ?? {},
    defaultSecondsPerKill: d.defaultSecondsPerKill ?? def.defaultSecondsPerKill,
    hoursPerDay: d.hoursPerDay ?? def.hoursPerDay,
  }
}

/** The level range a level goal uses: the goal's own levels, or the preset's range. */
export function goalLevels(doc: ResourceDoc, preset: Pick<LevelPresetDoc, 'levelFrom' | 'levelTo'> | null): { from: number; to: number } {
  return { from: doc.goal.fromLevel ?? preset?.levelFrom ?? 1, to: doc.goal.toLevel ?? preset?.levelTo ?? 1 }
}

/** What the player needs, by item id (RC-3). */
export function neededResources(doc: ResourceDoc, preset: LevelPresetDoc | null): { needs: Array<{ itemId: Id; amount: number }>; errors: string[] } {
  if (doc.goal.mode === 'amount') {
    return { needs: doc.goal.itemId && doc.goal.amount > 0 ? [{ itemId: doc.goal.itemId, amount: doc.goal.amount }] : [], errors: [] }
  }
  if (!preset) return { needs: [], errors: [] }
  const { from, to } = goalLevels(doc, preset)
  const { totals, errors } = levelUpCosts(preset.costs, from, to)
  return { needs: [...totals].filter(([, amount]) => amount > 0).map(([itemId, amount]) => ({ itemId, amount })), errors }
}

/** Average amount per drop row: mean of min and max, times the chance. */
export function expectedPerDrop(row: { amountMin: number; amountMax: number; chancePercent: number }): number {
  const min = Math.max(0, row.amountMin || 0)
  const max = Math.max(min, row.amountMax || 0)
  const chance = Math.min(100, Math.max(0, row.chancePercent || 0)) / 100
  return ((min + max) / 2) * chance
}

export interface Source {
  key: string
  kind: 'enemy' | 'other'
  /** Enemy id or other-source id. */
  refId: Id
  name: string
  /** Expected amount of the item per kill or run. */
  perRun: number
  secondsPerRun: number
  /** True when the enemy has no time to defeat and the default is used. */
  defaultTime: boolean
  runsPerDay: number | null
}

/** Every enemy and other source that gives an item (RC-6, RC-7). */
export function sourcesForItem(itemId: Id, enemies: readonly Enemy[], doc: ResourceDoc): Source[] {
  const out: Source[] = []
  for (const e of enemies) {
    const perRun = (e.dropTable ?? []).filter((r) => r.itemId === itemId).reduce((s, r) => s + expectedPerDrop(r), 0)
    if (!(e.dropTable ?? []).some((r) => r.itemId === itemId)) continue
    const t = e.timeToDefeatSeconds
    out.push({
      key: `enemy:${e.id}`,
      kind: 'enemy',
      refId: e.id,
      name: e.name,
      perRun,
      secondsPerRun: t !== null && t !== undefined && t > 0 ? t : doc.defaultSecondsPerKill,
      defaultTime: !(t !== null && t !== undefined && t > 0),
      runsPerDay: doc.enemyRunsPerDay[e.id] ?? null,
    })
  }
  for (const o of doc.otherSources) {
    if (o.itemId !== itemId) continue
    out.push({
      key: `other:${o.id}`,
      kind: 'other',
      refId: o.id,
      name: o.name,
      perRun: expectedPerDrop(o),
      secondsPerRun: Math.max(0, o.secondsPerRun || 0),
      defaultTime: false,
      runsPerDay: o.runsPerDay,
    })
  }
  return out
}

export interface Plan {
  /** Expected runs or kills to get the amount (RC-5). */
  runs: number
  /** Playing time, in seconds (RC-2). */
  seconds: number
  /** Days, limited by daily runs and by play time per day. */
  days: number
}

/** How long one source takes to give `needed` items, or null if it can never give any. */
export function planFor(needed: number, source: Source, hoursPerDay: number): Plan | null {
  if (source.perRun <= 0 || needed <= 0) return null
  const runs = Math.ceil(needed / source.perRun - 1e-9)
  const seconds = runs * source.secondsPerRun
  const byLimit = source.runsPerDay && source.runsPerDay > 0 ? Math.ceil(runs / source.runsPerDay - 1e-9) : 0
  const byTime = hoursPerDay > 0 ? seconds / (hoursPerDay * 3600) : 0
  return { runs, seconds, days: Math.max(byLimit, byTime) }
}

/** Sources with their plans, fastest first (by days, then playing time); sources that never drop it go last. */
export function rankSources(needed: number, sources: Source[], hoursPerDay: number): Array<{ source: Source; plan: Plan | null }> {
  return sources
    .map((source) => ({ source, plan: planFor(needed, source, hoursPerDay) }))
    .sort((a, b) => {
      if (!a.plan || !b.plan) return a.plan ? -1 : b.plan ? 1 : 0
      return a.plan.days - b.plan.days || a.plan.seconds - b.plan.seconds
    })
}

/** "6 h 40 min", "45 s", "3 d 2 h". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  const rest = s % 60
  return rest > 0 ? `${m} min ${rest} s` : `${m} min`
}

/** "about 3 days", rounding up to whole days past the first. */
export function formatDays(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return '—'
  if (days <= 1) return days < 1 ? 'under 1 day' : '1 day'
  const n = Math.ceil(days - 1e-9)
  return `${n} days`
}
