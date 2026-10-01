import { describe, expect, it } from 'vitest'
import { createEntity, type Enemy } from '@/core/model'
import { createLevelPresetDoc, type LevelPresetDoc } from '@/shared/calculators'
import { createResourceDoc, formatDays, formatDuration, neededResources, planFor, rankSources, sourcesForItem, type ResourceDoc } from './logic'

const golem = (): Enemy => ({
  ...(createEntity('enemy', 'Cave Golem') as Enemy),
  id: 'golem',
  stats: { DEF: 50 },
  dropTable: [{ id: 'd1', itemId: 'ore', amountMin: 2, amountMax: 2, chancePercent: 50 }],
  timeToDefeatSeconds: 60,
})

const preset = (): LevelPresetDoc => ({
  ...createLevelPresetDoc(),
  levelFrom: 1,
  levelTo: 21,
  costs: [{ id: 'c', stat: '', base: 20, mode: 'flat', perLevel: 0, expression: '', itemId: 'ore' }],
})

describe('Resource Calculator', () => {
  it('400 Ore at 2 × 50% per 1-minute kill = 400 kills, about 6 h 40 min (spec 8.9 AC)', () => {
    const doc: ResourceDoc = { ...createResourceDoc(), goal: { ...createResourceDoc().goal, mode: 'level', levelPresetId: 'p' } }
    const { needs } = neededResources(doc, preset())
    expect(needs).toEqual([{ itemId: 'ore', amount: 400 }])
    const [src] = sourcesForItem('ore', [golem()], doc)
    expect(src.perRun).toBe(1)
    const plan = planFor(400, src, doc.hoursPerDay)!
    expect(plan.runs).toBe(400)
    expect(formatDuration(plan.seconds)).toBe('6 h 40 min')
  })

  it('uses the goal levels instead of the preset range when set', () => {
    const doc: ResourceDoc = { ...createResourceDoc(), goal: { ...createResourceDoc().goal, fromLevel: 1, toLevel: 6 } }
    expect(neededResources(doc, preset()).needs[0].amount).toBe(100)
  })

  it('supports a fixed amount goal', () => {
    const doc: ResourceDoc = { ...createResourceDoc(), goal: { ...createResourceDoc().goal, mode: 'amount', itemId: 'ore', amount: 30 } }
    expect(neededResources(doc, null).needs).toEqual([{ itemId: 'ore', amount: 30 }])
  })

  it('finds every enemy and other source of an item, fastest first (RC-6, RC-7)', () => {
    const slow = { ...golem(), id: 'slow', name: 'Slow', timeToDefeatSeconds: null, dropTable: [{ id: 'x', itemId: 'ore', amountMin: 1, amountMax: 3, chancePercent: 100 }] }
    const none = { ...golem(), id: 'none', dropTable: [] }
    const doc: ResourceDoc = {
      ...createResourceDoc(),
      defaultSecondsPerKill: 600,
      otherSources: [{ id: 'chest', name: 'Daily chest', itemId: 'ore', amountMin: 50, amountMax: 50, chancePercent: 100, secondsPerRun: 30, runsPerDay: 1 }],
    }
    const sources = sourcesForItem('ore', [slow, golem(), none], doc)
    expect(sources.map((s) => s.refId)).toEqual(['slow', 'golem', 'chest'])
    expect(sources[0]).toMatchObject({ perRun: 2, secondsPerRun: 600, defaultTime: true })
    const ranked = rankSources(100, sources, 2)
    // golem: 100 kills × 60 s = 100 min, under a day; chest: 2 days; slow: 50 × 600 s = 8.3 h = 4.2 days of 2 h.
    expect(ranked.map((r) => r.source.refId)).toEqual(['golem', 'chest', 'slow'])
    expect(ranked[1].plan!.days).toBe(2)
  })

  it('gives no plan for a source that cannot drop anything', () => {
    const zero = { ...golem(), dropTable: [{ id: 'z', itemId: 'ore', amountMin: 1, amountMax: 1, chancePercent: 0 }] }
    const [src] = sourcesForItem('ore', [zero], createResourceDoc())
    expect(planFor(10, src, 2)).toBeNull()
  })

  it('formats durations and days', () => {
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(90)).toBe('1 min 30 s')
    expect(formatDuration(3 * 86400 + 7200)).toBe('3 d 2 h')
    expect(formatDays(0.5)).toBe('under 1 day')
    expect(formatDays(2.1)).toBe('3 days')
  })
})
