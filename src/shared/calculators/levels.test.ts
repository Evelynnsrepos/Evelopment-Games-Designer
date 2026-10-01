import { describe, expect, it } from 'vitest'
import { createLevelPresetDoc, normalizeLevelPresetDoc, type CostRow } from './docs'
import { enemyStatsAtLevel, growthValue, levelRange, levelUpCosts, statsAtLevel, xpTable } from './levels'

const row = (patch: Partial<CostRow>): CostRow => ({ id: 'r', stat: '', base: 0, mode: 'flat', perLevel: 0, expression: '', itemId: 'ore', ...patch })

describe('growth', () => {
  it('grows flat, percent and by formula', () => {
    expect(growthValue(row({ base: 100, perLevel: 10 }), 2)).toBe(110)
    expect(growthValue(row({ base: 100, mode: 'percent', perLevel: 10 }), 3)).toBeCloseTo(121)
    expect(growthValue(row({ base: 5, mode: 'formula', expression: 'Base * Level' }), 4)).toBe(20)
  })

  it('collects named stats and skips broken rows', () => {
    const stats = statsAtLevel(
      [
        { ...row({ stat: 'ATK', base: 100, perLevel: 10 }) },
        { ...row({ stat: 'HP', mode: 'formula', expression: 'Level +' }) },
        { ...row({ stat: '  ', base: 1 }) },
      ],
      2,
    )
    expect(stats).toEqual({ ATK: 110 })
  })

  it('grows enemy stats like the Enemy List', () => {
    const s = enemyStatsAtLevel({ stats: { DEF: 50, HP: 100 }, growth: [{ stat: 'HP', mode: 'percent', perLevel: 10 }] }, 2)
    expect(s.DEF).toBe(50)
    expect(s.HP).toBeCloseTo(110)
  })
})

describe('xp table', () => {
  it('lists XP to next level and running totals (LV-2)', () => {
    const doc = { levelFrom: 1, levelTo: 3, xp: { enabled: true, formulaId: 'xp-linear', expression: '', values: { Base: 100, Increase: 50 } } }
    expect(xpTable(doc)).toEqual([
      { level: 1, toNext: 100, total: 0 },
      { level: 2, toNext: 150, total: 100 },
      { level: 3, toNext: 200, total: 250 },
    ])
  })

  it('supports custom formulas and reports broken ones as null', () => {
    const ok = xpTable({ levelFrom: 2, levelTo: 2, xp: { enabled: true, formulaId: null, expression: 'Level * 10', values: {} } })
    expect(ok[0].toNext).toBe(20)
    const bad = xpTable({ levelFrom: 1, levelTo: 2, xp: { enabled: true, formulaId: null, expression: '1 +', values: {} } })
    expect(bad.map((r) => r.toNext)).toEqual([null, null])
  })

  it('clamps huge ranges', () => {
    expect(levelRange({ levelFrom: 1, levelTo: 1e9 }).length).toBe(1000)
    expect(levelRange({ levelFrom: 5, levelTo: 2 })).toEqual([5])
  })
})

describe('level-up costs', () => {
  it('sums every level-up between two levels (RC-3)', () => {
    // 20 Ore per level-up, level 1 to 21 = 20 level-ups = 400 Ore.
    const { totals } = levelUpCosts([row({ base: 20 })], 1, 21)
    expect(totals.get('ore')).toBe(400)
  })

  it('rounds each level-up to whole items and merges rows of the same item', () => {
    const { totals } = levelUpCosts([row({ base: 1.4 }), row({ id: 'b', base: 2 })], 1, 3)
    expect(totals.get('ore')).toBe(2 + 4)
  })

  it('skips rows without an item and reports broken formulas', () => {
    const { totals, errors } = levelUpCosts([row({ itemId: null, base: 5 }), row({ id: 'bad', mode: 'formula', expression: 'x' })], 1, 5)
    expect(totals.size).toBe(0)
    expect(errors).toEqual(['bad'])
  })
})

describe('normalize', () => {
  it('fills missing fields with defaults', () => {
    const d = normalizeLevelPresetDoc({ levelTo: 20, costs: [{ id: 'c' } as CostRow] })
    expect(d.levelFrom).toBe(1)
    expect(d.levelTo).toBe(20)
    expect(d.costs[0]).toMatchObject({ id: 'c', mode: 'flat', itemId: null })
    expect(d.xp).toEqual(createLevelPresetDoc().xp)
  })
})

describe('enemy targets', () => {
  it('takes only defensive stats and the level from an enemy', async () => {
    const { enemyTargetValues } = await import('./levels')
    const v = enemyTargetValues({ stats: { ATK: 999, DEF: 50, HP: 100 }, growth: [{ stat: 'DEF', mode: 'flat', perLevel: 5 }] }, 3)
    expect(v).toEqual({ EnemyLevel: 3, DEF: 60, HP: 100 })
  })
})
