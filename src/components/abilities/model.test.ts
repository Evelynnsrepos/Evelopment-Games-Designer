import { describe, expect, it } from 'vitest'
import { abilityStats, newAbility } from './model'

describe('abilities', () => {
  it('works out damage per second and per cost from a preset', () => {
    const presets = [{ id: 'p', title: 'Hit', expression: 'ATK * 2', values: { ATK: 10 } }]
    const a = { ...newAbility(), source: 'preset' as const, presetId: 'p', values: { ATK: 15 }, cooldown: 2, castTime: 1, cost: 10 }
    expect(abilityStats(a, presets)).toEqual({ value: 30, perSecond: 15, perCost: 3, error: null })
    expect(abilityStats({ ...a, presetId: 'gone' }, presets).error).toBe('Pick a formula')
    expect(abilityStats({ ...a, source: 'none' }, presets).error).toBeNull()
  })

  it('uses library formulas with their defaults', () => {
    const s = abilityStats(newAbility(), [])
    expect(s.error).toBeNull()
    expect(s.value).toBeGreaterThan(0)
  })
})
