import { newId, type Id } from '@/core/model'
import { useDocument } from '@/core/state'

/**
 * Custom calendars and eras (v0.10): the world's months, weekdays and named
 * ages. Shared so the Timeline can show years as "305 TA" instead of 305.
 * Years are whole numbers on one absolute scale, like the Timeline's.
 */

export interface Month {
  id: Id
  name: string
  days: number
}

export interface Era {
  id: Id
  name: string
  /** Short form after the year, e.g. "TA". */
  abbr: string
  /** Absolute year in which this era's year 1 starts. */
  start: number
  color: string
}

export interface CalendarDoc {
  months: Month[]
  weekdays: string[]
  eras: Era[]
  /** Weekday (index) of day 1 of year 1. */
  firstWeekday: number
  /** Show era years on timelines. */
  useOnTimeline: boolean
}

const month = (name: string, days: number): Month => ({ id: newId(), name, days })

export function createCalendarDoc(): CalendarDoc {
  return {
    months: [
      month('Frostmoon', 30),
      month('Thawmoon', 30),
      month('Seedmoon', 31),
      month('Bloommoon', 30),
      month('Sunmoon', 31),
      month('Highsun', 30),
      month('Harvest', 31),
      month('Leaffall', 30),
      month('Mistmoon', 30),
      month('Darkmoon', 31),
    ],
    weekdays: ['Moonday', 'Fireday', 'Waterday', 'Earthday', 'Windday', 'Starday'],
    eras: [],
    firstWeekday: 0,
    useOnTimeline: true,
  }
}

export const newEra = (start: number): Era => ({ id: newId(), name: 'New era', abbr: 'NE', start, color: '#9c36b5' })

export const CALENDAR_DOC = { type: 'calendar' as const, id: 'calendar' }

export function useCalendar() {
  return useDocument<CalendarDoc>(CALENDAR_DOC.type, CALENDAR_DOC.id, createCalendarDoc)
}

export const yearLength = (c: CalendarDoc) => c.months.reduce((s, m) => s + Math.max(0, m.days), 0)

/** The era a year falls in: the latest one that has started. */
export function eraOf(c: CalendarDoc, year: number): Era | undefined {
  return [...c.eras].sort((a, b) => b.start - a.start).find((e) => e.start <= year)
}

/** "305 TA", or "12 before FA" for years before the first era, or the plain number without eras. */
export function formatYear(c: CalendarDoc | undefined, year: number): string {
  if (!c || !c.eras.length) return String(year)
  const era = eraOf(c, year)
  if (era) return `${year - era.start + 1} ${era.abbr}`
  const first = [...c.eras].sort((a, b) => a.start - b.start)[0]
  return `${first.start - year} before ${first.abbr}`
}

/** Days since day 1 of year 1 (0-based) for a date; months and days are 1-based. */
export function toDayNumber(c: CalendarDoc, year: number, monthIndex: number, day: number): number {
  const len = yearLength(c)
  const before = c.months.slice(0, monthIndex).reduce((s, m) => s + m.days, 0)
  return (year - 1) * len + before + (day - 1)
}

export function fromDayNumber(c: CalendarDoc, n: number): { year: number; month: number; day: number } {
  const len = Math.max(1, yearLength(c))
  const year = Math.floor(n / len) + 1
  let rest = n - (year - 1) * len
  let month = 0
  while (month < c.months.length - 1 && rest >= c.months[month].days) {
    rest -= c.months[month].days
    month++
  }
  return { year, month, day: rest + 1 }
}

export const weekdayOf = (c: CalendarDoc, n: number) => (c.weekdays.length ? (((n + c.firstWeekday) % c.weekdays.length) + c.weekdays.length) % c.weekdays.length : 0)
