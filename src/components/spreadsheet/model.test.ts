import { describe, expect, it } from 'vitest'
import { addr, colName, fillSeries, formatValue, parseAddr, serialToDate, sheetRef } from './model'

describe('spreadsheet model', () => {
  it('names columns and parses addresses', () => {
    expect([colName(0), colName(25), colName(26), colName(701), colName(702)]).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA'])
    expect(addr(27, 9)).toBe('AB10')
    expect(parseAddr('AB10')).toEqual({ col: 27, row: 9 })
    expect(parseAddr('10A')).toBeNull()
    expect(sheetRef('Sheet1')).toBe('Sheet1')
    expect(sheetRef("Bob's loot")).toBe("'Bob''s loot'")
  })

  it('fills series like Excel', () => {
    expect(fillSeries(['5'], 3)).toEqual(['5', '5', '5'])
    expect(fillSeries(['1', '3'], 3)).toEqual(['5', '7', '9'])
    expect(fillSeries(['0.1', '0.2'], 2)).toEqual(['0.3', '0.4'])
    expect(fillSeries(['30.12.2026'], 3)).toEqual(['31.12.2026', '01.01.2027', '02.01.2027'])
    expect(fillSeries(['2026-01-15', '2026-02-15'], 2)).toEqual(['2026-03-15', '2026-04-15'])
    expect(fillSeries(['Item 1'], 2)).toEqual(['Item 2', 'Item 3'])
    expect(fillSeries(['Wave 08'], 2)).toEqual(['Wave 09', 'Wave 10'])
    expect(fillSeries(['November'], 3)).toEqual(['December', 'January', 'February'])
    expect(fillSeries(['Mon', 'Wed'], 2)).toEqual(['Fri', 'Sun'])
    expect(fillSeries(['Montag'], 1)).toEqual(['Dienstag'])
    expect(fillSeries(['a', 'b'], 3)).toEqual(['a', 'b', 'a'])
  })

  it('formats values', () => {
    expect(serialToDate(46298)).toBe('03.10.2026')
    expect(formatValue(0.1 + 0.2, undefined, false)).toBe('0.3')
    expect(formatValue(0.256, { fmt: 'percent', dp: 1 }, false)).toMatch(/25[.,]6%/)
    expect(formatValue(true, undefined, false)).toBe('TRUE')
  })
})

describe('moving formulas', async () => {
  const { shiftFormula } = await import('./model')
  it('moves relative references and keeps absolute ones', () => {
    expect(shiftFormula('=A1+$B$2+C$3+$D4', 1, 2)).toBe('=B3+$B$2+D$3+$D6')
    expect(shiftFormula('=SUM(A1:A3)*Sheet2!B1', 0, 1)).toBe('=SUM(A2:A4)*Sheet2!B2')
    expect(shiftFormula('=LOG10(A1)&"A1"', 1, 0)).toBe('=LOG10(B1)&"A1"')
    expect(shiftFormula('=A1', -1, 0)).toBe('=#REF!')
    expect(shiftFormula('12', 3, 3)).toBe('12')
  })
})
