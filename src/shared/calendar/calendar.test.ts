import { describe, expect, it } from 'vitest'
import { createCalendarDoc, formatYear, fromDayNumber, newEra, toDayNumber, weekdayOf, yearLength } from './calendar'

describe('calendar', () => {
  const c = createCalendarDoc()

  it('counts days and converts dates both ways', () => {
    expect(yearLength(c)).toBe(304)
    const n = toDayNumber(c, 3, 2, 5)
    expect(n).toBe(2 * 304 + 60 + 4)
    expect(fromDayNumber(c, n)).toEqual({ year: 3, month: 2, day: 5 })
    expect(fromDayNumber(c, 0)).toEqual({ year: 1, month: 0, day: 1 })
    expect(weekdayOf(c, 7)).toBe(1)
  })

  it('formats years by era', () => {
    expect(formatYear(c, 305)).toBe('305')
    const cal = { ...c, eras: [{ ...newEra(1), abbr: 'FA' }, { ...newEra(500), abbr: 'SA' }] }
    expect(formatYear(cal, 305)).toBe('305 FA')
    expect(formatYear(cal, 512)).toBe('13 SA')
    expect(formatYear(cal, -9)).toBe('10 before FA')
  })
})
