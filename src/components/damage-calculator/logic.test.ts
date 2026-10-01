import { describe, expect, it } from 'vitest'
import { createDamagePresetDoc, type DamagePresetDoc } from '@/shared/calculators'
import { activeFormula, evaluateDoc, rangeRows, switchFormula } from './logic'

const value = (d: DamagePresetDoc) => {
  const r = evaluateDoc(d)
  return r && r.ok ? r.value : null
}

describe('Damage Calculator', () => {
  it('opens on percentage armor: ATK 100, DEF 50, K 100 = 66.67 (spec 8.3 AC)', () => {
    const d = createDamagePresetDoc()
    expect(d.formulaId).toBe('percentage-armor')
    expect(value({ ...d, values: { ATK: 100, DEF: 50, K: 100 } })).toBeCloseTo(66.667, 2)
  })

  it('keeps values of same-named variables when switching formulas', () => {
    const d = { ...createDamagePresetDoc(), values: { ATK: 300, DEF: 20, K: 100 } }
    const flat = switchFormula(d, 'flat-armor')
    expect(flat.values.ATK).toBe(300)
    expect(flat.values.DEF).toBe(20)
    expect(value(flat)).toBe(280)
  })

  it('starts a custom formula as a copy of the current one and finds its variables (CA-5)', () => {
    const custom = switchFormula(createDamagePresetDoc(), null)
    expect(custom.expression).toBe('ATK * (1 - DEF / (DEF + K))')
    const edited = { ...custom, expression: 'ATK * Bonus' }
    expect(activeFormula(edited).variables.map((v) => v.name)).toEqual(['ATK', 'Bonus'])
    expect(value(edited)).toBe(100) // Bonus has no value yet and starts at 1
  })

  it('reports custom formula errors without throwing', () => {
    const d = { ...switchFormula(createDamagePresetDoc(), null), expression: 'ATK * (' }
    expect(activeFormula(d).error).toBeTruthy()
    expect(evaluateDoc(d)?.ok).toBe(false)
    expect(activeFormula(d).variables.map((v) => v.name)).toEqual(['ATK'])
  })

  it('sweeps a variable across a range (CA-6)', () => {
    const d = { ...createDamagePresetDoc(), values: { ATK: 100, DEF: 50, K: 100 } }
    const rows = rangeRows({ ...d, range: { ...d.range, variable: 'ATK', from: 100, to: 130, step: 10 } })
    expect(rows.map((r) => Math.round(r.value! * 100) / 100)).toEqual([66.67, 73.33, 80, 86.67])
  })
})
