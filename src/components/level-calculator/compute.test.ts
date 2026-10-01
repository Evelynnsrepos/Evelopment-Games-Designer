import { describe, expect, it } from 'vitest'
import { createEntity, type Enemy } from '@/core/model'
import { createDamagePresetDoc, createLevelPresetDoc, type LevelPresetDoc } from '@/shared/calculators'
import { computeLevels, damageSource, numericCategoryStats, variableOrigins } from './compute'

const atkRow = { id: 's1', stat: 'ATK', base: 100, mode: 'flat' as const, perLevel: 10, expression: '' }

function acDoc(): LevelPresetDoc {
  const d = createLevelPresetDoc()
  return {
    ...d,
    levelFrom: 1,
    levelTo: 3,
    stats: [atkRow],
    damage: { source: 'formula', presetId: null, formulaId: 'percentage-armor', values: { ATK: 0, DEF: 0, K: 100 } },
    target: { mode: 'fixed', values: { DEF: 50 }, enemyId: null, enemyLevel: null },
  }
}

describe('Level Calculator', () => {
  it('shows damage per level: 66.67 at level 1 and 73.33 at level 2 (spec 8.3 AC Level)', () => {
    const doc = acDoc()
    const { rows } = computeLevels(doc, damageSource(doc, null), null)
    expect(rows.map((r) => Math.round(r.damage! * 100) / 100)).toEqual([66.67, 73.33, 80])
    expect(rows[1].stats.ATK).toBe(110)
  })

  it('uses a Damage Calculator preset (LV-4)', () => {
    const doc: LevelPresetDoc = { ...acDoc(), damage: { ...acDoc().damage, source: 'preset', presetId: 'p' } }
    const preset = { id: 'p', name: 'Sword', data: { ...createDamagePresetDoc(), values: { ATK: 1, DEF: 1, K: 100 } } }
    const { rows } = computeLevels(doc, damageSource(doc, preset), null)
    expect(rows[0].damage).toBeCloseTo(66.667, 2)
    expect(damageSource(doc, null)).toBeNull()
  })

  it('targets an enemy and counts hits to defeat it (LV-5)', () => {
    const golem = { ...createEntity('enemy', 'Cave Golem'), stats: { HP: 200, ATK: 999, DEF: 50 } } as Enemy
    const doc: LevelPresetDoc = { ...acDoc(), target: { mode: 'enemy', values: {}, enemyId: golem.id, enemyLevel: 1 } }
    const { rows } = computeLevels(doc, damageSource(doc, null), golem)
    expect(rows[0].damage).toBeCloseTo(66.667, 2) // enemy ATK does not replace the attacker's ATK
    expect(rows[0].targetHp).toBe(200)
    expect(rows[0].hits).toBe(3)
    expect(rows[2].hits).toBe(3) // 200 / 80 = 2.5
  })

  it('fills XP and level-up cost columns (LV-2, LV-6)', () => {
    const doc: LevelPresetDoc = {
      ...acDoc(),
      xp: { enabled: true, formulaId: 'xp-linear', expression: '', values: { Base: 100, Increase: 50 } },
      costs: [{ id: 'c1', stat: '', base: 20, mode: 'flat', perLevel: 5, expression: '', itemId: 'ore' }],
    }
    const { rows } = computeLevels(doc, null, null)
    expect(rows.map((r) => r.totalXp)).toEqual([0, 100, 250])
    expect(rows.map((r) => r.costs.c1)).toEqual([20, 25, 30])
    expect(rows[0].damage).toBeNull()
  })

  it('reports a broken damage formula once', () => {
    const doc: LevelPresetDoc = { ...acDoc(), damage: { ...acDoc().damage, source: 'preset', presetId: 'p' } }
    const preset = { id: 'p', name: 'Bad', data: { ...createDamagePresetDoc(), formulaId: null, expression: 'ATK *' } }
    expect(computeLevels(doc, damageSource(doc, preset), null).damageError).toBeTruthy()
  })

  it('knows where each formula variable comes from', () => {
    expect(variableOrigins(['ATK', 'DEF', 'K', 'Level'], acDoc())).toEqual({ ATK: 'stat', DEF: 'target', K: 'input', Level: 'level' })
  })

  it('reads number categories as stats', () => {
    expect(numericCategoryStats({ a: 12, b: 'x' }, [{ id: 'a', name: 'Mastery', kind: 'number' }, { id: 'b', name: 'Nation', kind: 'text' }])).toEqual({ Mastery: 12 })
  })
})
