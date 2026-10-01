import { describe, expect, it } from 'vitest'
import {
  FORMULA_GROUPS,
  FORMULA_LIBRARY,
  FormulaError,
  compile,
  defaultValues,
  evaluatePreset,
  evaluateRange,
  formatNumber,
  getFormula,
  libraryFor,
  tryCompile,
  tryEvaluate,
} from '.'

const calc = (src: string, vars: Record<string, number> = {}) => compile(src).evaluate(vars)
const errorOf = (src: string, vars: Record<string, number> = {}) => {
  const r = tryEvaluate(src, vars)
  if (r.ok) throw new Error(`expected an error for ${src}`)
  return r.error
}

describe('expression language (CA-5)', () => {
  it('follows normal precedence', () => {
    expect(calc('1 + 2 * 3')).toBe(7)
    expect(calc('(1 + 2) * 3')).toBe(9)
    expect(calc('10 - 4 - 3')).toBe(3)
    expect(calc('24 / 4 / 2')).toBe(3)
    expect(calc('7 % 3')).toBe(1)
  })

  it('makes powers right-associative and binds them tighter than unary minus', () => {
    expect(calc('2 ^ 3 ^ 2')).toBe(512)
    expect(calc('-2 ^ 2')).toBe(-4)
    expect(calc('2 ^ -1')).toBe(0.5)
    expect(calc('--3')).toBe(3)
  })

  it('accepts the written symbols × ÷ − and number formats', () => {
    expect(calc('6 × 2 ÷ 3 − 1')).toBe(3)
    expect(calc('.5 + 1.5e2 + 2.')).toBe(152.5)
  })

  it('has min, max, floor, round and friends', () => {
    expect(calc('min(3, 1, 2) + max(4, 9)')).toBe(10)
    expect(calc('floor(2.7) + ceil(2.1)')).toBe(5)
    expect(calc('round(2.5) + round(66.6666, 2)')).toBe(69.67)
    expect(calc('clamp(150, 0, 100)')).toBe(100)
    expect(calc('sqrt(16) + abs(-2) + log(1000) + log(8, 2) + ln(e)')).toBeCloseTo(13)
    expect(calc('round(pi, 2)')).toBe(3.14)
  })

  it('supports comparisons and lazy if/and/or', () => {
    expect(calc('if(HP <= 0, 0, HP)', { HP: -5 })).toBe(0)
    expect(calc('if(HP <= 0, 0, HP)', { HP: 30 })).toBe(30)
    expect(calc('and(1 < 2, 2 ≥ 2) + or(0, 0) + not(0)')).toBe(2)
    // The branch not taken is never evaluated, so its division by zero does not matter.
    expect(calc('if(D == 0, 0, 10 / D)', { D: 0 })).toBe(0)
  })

  it('lists variables in order of first use, without constants', () => {
    expect(compile('ATK * (1 - DEF / (DEF + K)) + pi').variables).toEqual(['ATK', 'DEF', 'K'])
  })

  it('reads values from a Map too', () => {
    expect(compile('a + b').evaluate(new Map([['a', 1], ['b', 2]]))).toBe(3)
  })

  it('reports helpful errors with a position', () => {
    expect(errorOf('')).toMatchObject({ message: 'Formula is empty' })
    expect(errorOf('1 +')).toMatchObject({ message: 'Formula ends too early', pos: 3 })
    expect(errorOf('2 * (3 + 4')).toMatchObject({ message: 'Expected ")" but found end of formula' })
    expect(errorOf('2 $ 3')).toMatchObject({ message: 'Unexpected "$"', pos: 2 })
    expect(errorOf('1 2')).toMatchObject({ message: 'Unexpected "2"', pos: 2 })
    expect(errorOf('foo(1)')).toMatchObject({ message: 'Unknown function "foo"', pos: 0 })
    expect(errorOf('min()').message).toBe('min() takes at least 1 values, got 0')
    expect(errorOf('round(1, 2, 3)').message).toBe('round() takes 1 or 2 values, got 3')
    expect(errorOf('ATK * 2').message).toBe('No value for "ATK"')
    expect(errorOf('1 / 0').message).toBe('Division by zero')
    expect(errorOf('sqrt(-1)').message).toBe('Result is not a finite number')
    expect(errorOf('1 < 2 < 3').message).toMatch(/and\(/)
  })

  it('cannot reach JavaScript internals', () => {
    for (const src of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(errorOf(src).message).toBe(`No value for "${src}"`)
    }
    expect(errorOf('constructor(1)').message).toBe('Unknown function "constructor"')
    expect(errorOf('toString(1)').message).toBe('Unknown function "toString"')
    expect(tryCompile('alert("x")').ok).toBe(false)
    expect(tryCompile('a.b').ok).toBe(false)
    expect(tryCompile('a[0]').ok).toBe(false)
    expect(tryCompile('x = 1').ok).toBe(false)
  })

  it('rejects absurdly long or deeply nested input instead of crashing', () => {
    expect(tryCompile('1+'.repeat(1500) + '1').ok).toBe(false)
    expect(tryCompile('('.repeat(500) + '1' + ')'.repeat(500)).ok).toBe(false)
    expect(tryCompile('-'.repeat(500) + '1').ok).toBe(false)
  })

  it('throws FormulaError from compile', () => {
    expect(() => compile('1 +')).toThrow(FormulaError)
  })
})

describe('formula library (CA-1, CA-3)', () => {
  it('meets the spec acceptance: Percentage armor with ATK 100, DEF 50, K 100 is 66.67', () => {
    const f = getFormula('percentage-armor')!
    expect(f.name).toBe('Percentage armor')
    expect(formatNumber(compile(f.expression).evaluate({ ATK: 100, DEF: 50, K: 100 }))).toBe('66.67')
    expect(formatNumber(compile(f.expression).evaluate(defaultValues(f)))).toBe('66.67')
  })

  it('groups the damage calculator formulas by game type, covering the minimum groups', () => {
    const groups = libraryFor('damage')
    expect(groups.map((g) => g.name)).toEqual([
      'Elemental reactions',
      'Raw damage with armor',
      'Critical hits',
      'Damage over time and multi-hit',
      'Resistances and weaknesses',
    ])
    for (const g of groups) {
      expect(g.formulas.length).toBeGreaterThan(0)
      expect(g.gameTypes).not.toBe('')
    }
    const ids = groups.flatMap((g) => g.formulas.map((f) => f.id))
    for (const id of ['amplifying-reaction', 'transformative-reaction', 'flat-armor', 'armor-penetration', 'crit-average', 'dot-total', 'multi-hit']) {
      expect(ids).toContain(id)
    }
  })

  it('has XP curves and stat growth for the level calculator (LV-1, LV-3)', () => {
    expect(libraryFor('level').map((g) => g.id)).toEqual(['xp-curve', 'stat-growth'])
  })

  it('every formula compiles, declares exactly its variables, and evaluates with its defaults', () => {
    const ids = new Set<string>()
    for (const f of FORMULA_LIBRARY) {
      expect(ids.has(f.id), `duplicate id ${f.id}`).toBe(false)
      ids.add(f.id)
      expect(FORMULA_GROUPS.some((g) => g.id === f.groupId), `${f.id} group`).toBe(true)
      expect(f.writtenForm && f.description, `${f.id} text`).toBeTruthy()
      const compiled = compile(f.expression)
      expect([...compiled.variables].sort(), f.id).toEqual(f.variables.map((x) => x.name).sort())
      expect(Number.isFinite(compiled.evaluate(defaultValues(f))), f.id).toBe(true)
    }
  })

  it('computes known values', () => {
    const run = (id: string, vars: Record<string, number> = {}) => {
      const f = getFormula(id)!
      return compile(f.expression).evaluate({ ...defaultValues(f), ...vars })
    }
    expect(run('flat-armor', { ATK: 100, DEF: 120 })).toBe(1)
    expect(run('crit-average', { Damage: 1000, CritRate: 50, CritDMG: 100 })).toBe(1500)
    expect(run('crit-average', { Damage: 1000, CritRate: 150, CritDMG: 100 })).toBe(2000)
    expect(run('dot-total', { TickDamage: 50, Duration: 10, TickInterval: 3 })).toBe(150)
    expect(run('hits-to-defeat', { HP: 1000, Damage: 300 })).toBe(4)
    expect(run('resistance-percent', { Damage: 1000, RES: 10 })).toBe(900)
    expect(run('resistance-percent', { Damage: 1000, RES: -20 })).toBe(1100)
    expect(run('resistance-percent', { Damage: 1000, RES: 100 })).toBe(200)
    expect(run('level-defense', { Damage: 1000, Level: 90, EnemyLevel: 90 })).toBe(500)
    expect(run('armor-penetration', { ATK: 100, DEF: 125, K: 100, PenPct: 20, FlatPen: 0 })).toBe(50)
    expect(run('xp-polynomial', { Base: 100, Exponent: 2, Level: 3 })).toBe(900)
  })
})

describe('ranges and presets (CA-4, CA-6, LV-4)', () => {
  it('meets the level acceptance: ATK 100 +10 per level vs DEF 50, K 100 gives 66.67 then 73.33', () => {
    const growth = compile(getFormula('stat-flat')!.expression)
    const damage = compile(getFormula('percentage-armor')!.expression)
    const rows = evaluateRange(growth, { Base: 100, PerLevel: 10 }, { variable: 'Level', from: 1, to: 90 })
    expect(rows).toHaveLength(90)
    const perLevel = rows.map((r) => damage.evaluate({ ATK: r.value!, DEF: 50, K: 100 }))
    expect(formatNumber(perLevel[0])).toBe('66.67')
    expect(formatNumber(perLevel[1])).toBe('73.33')
    expect(perLevel.every((d, i) => i === 0 || d > perLevel[i - 1])).toBe(true)
  })

  it('sweeps with fractional or descending steps and keeps per-row errors', () => {
    expect(evaluateRange('x', {}, { variable: 'x', from: 0, to: 0.3, step: 0.1 }).map((r) => r.x)).toEqual([0, 0.1, 0.2, 0.30000000000000004])
    expect(evaluateRange('x', {}, { variable: 'x', from: 3, to: 1 }).map((r) => r.value)).toEqual([3, 2, 1])
    const rows = evaluateRange('10 / x', {}, { variable: 'x', from: -1, to: 1 })
    expect(rows[1]).toEqual({ x: 0, value: null, error: 'Division by zero' })
    expect(evaluateRange('x', {}, { variable: 'x', from: 1, to: 1e9, maxRows: 5 })).toHaveLength(5)
  })

  it('evaluates library and custom presets with overrides', () => {
    const sword = { id: 'p1', name: 'Sword basic attack', formulaId: 'percentage-armor', values: { ATK: 100, DEF: 50, K: 100 } }
    expect(evaluatePreset(sword)).toMatchObject({ ok: true })
    const r = evaluatePreset(sword, { ATK: 110 })
    expect(r.ok && formatNumber(r.value)).toBe('73.33')

    const custom = { id: 'p2', name: 'Fireball', formulaId: null, expression: 'ATK * 2 + Bonus', values: { ATK: 10, Bonus: 5 } }
    expect(evaluatePreset(custom)).toEqual({ ok: true, value: 25 })

    const broken = { id: 'p3', name: 'Old', formulaId: 'no-such-formula', values: {} }
    const e = evaluatePreset(broken)
    expect(!e.ok && e.error.message).toBe('Unknown formula "no-such-formula"')
  })

  it('formats numbers for display', () => {
    expect(formatNumber(50)).toBe('50')
    expect(formatNumber(1234567.891)).toBe('1234567.89')
    expect(formatNumber(-0.004)).toBe('0')
    expect(formatNumber(2 / 3, 0)).toBe('1')
    expect(formatNumber(NaN)).toBe('—')
  })
})
