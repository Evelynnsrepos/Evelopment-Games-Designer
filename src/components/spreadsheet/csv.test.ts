import { describe, expect, it } from 'vitest'
import { parseCSV, toCSV } from '@/shared/csv'
import { parseRange } from './range'

describe('csv', () => {
  it('reads commas, semicolons, tabs, quotes and line breaks', () => {
    expect(parseCSV('a,b\r\n1,"x, ""y"""\n')).toEqual([
      ['a', 'b'],
      ['1', 'x, "y"'],
    ])
    expect(parseCSV('Name;Wert\nSchwert;1,5')).toEqual([
      ['Name', 'Wert'],
      ['Schwert', '1.5'],
    ])
    expect(parseCSV('a\tb\n"multi\nline"\t2')).toEqual([
      ['a', 'b'],
      ['multi\nline', '2'],
    ])
  })

  it('writes CSV and reads ranges', () => {
    expect(toCSV([['a', 'b,c'], ['"q"', '']])).toBe('a,"b,c"\r\n"""q""",\r\n')
    expect(parseRange('B2:A1')).toEqual({ c1: 0, r1: 0, c2: 1, r2: 1 })
    expect(parseRange('$C$3')).toEqual({ c1: 2, r1: 2, c2: 2, r2: 2 })
    expect(parseRange('nope')).toBeNull()
  })
})
