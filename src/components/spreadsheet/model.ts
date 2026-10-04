import { newId, type Id } from '@/core/model'

/**
 * Spreadsheet (v0.9): workbooks of sheets, Excel style. Cells store what the
 * user typed (`=SUM(A1:A3)`, `12`, `03.10.2026`); HyperFormula works out the
 * values. Styles live next to the raw input so they move with the cell.
 */

export interface Border {
  /** Line thickness in pixels: 1, 2 or 3. */
  w: number
  color: string
}

export type NumberFormat = 'general' | 'number' | 'percent' | 'currency' | 'date' | 'text'

export interface CellStyle {
  b?: boolean
  i?: boolean
  u?: boolean
  color?: string
  bg?: string
  align?: 'left' | 'center' | 'right'
  fmt?: NumberFormat
  /** Decimals for number, percent and currency. */
  dp?: number
  top?: Border
  right?: Border
  bottom?: Border
  left?: Border
}

export interface Cell {
  /** Raw input; a formula starts with "=". */
  v: string
  s?: CellStyle
}

export type ChartType = 'bar' | 'line' | 'pie'

/** A chart floating over the sheet, drawn from a range like A1:C6. */
export interface Chart {
  id: Id
  range: string
  type: ChartType
  title: string
  x: number
  y: number
  w: number
  h: number
}

export interface Sheet {
  id: Id
  name: string
  /** Rows at the top and columns at the left that stay put while scrolling. */
  freeze?: { rows: number; cols: number }
  charts?: Chart[]
  /** Keyed by A1 address, e.g. "B12". */
  cells: Record<string, Cell>
  colWidths: Record<number, number>
  rowHeights: Record<number, number>
}

export interface Workbook {
  sheets: Sheet[]
  activeSheetId: Id
}

export const DEFAULT_COL_WIDTH = 96
export const DEFAULT_ROW_HEIGHT = 24
export const MIN_ROWS = 100
export const MIN_COLS = 26

export const newSheet = (name: string): Sheet => ({ id: newId(), name, cells: {}, colWidths: {}, rowHeights: {} })

export function createWorkbook(): Workbook {
  const s = newSheet('Sheet1')
  return { sheets: [s], activeSheetId: s.id }
}

export function normalizeWorkbook(w: Partial<Workbook> | undefined): Workbook {
  if (!w?.sheets?.length) return createWorkbook()
  const sheets = w.sheets.map((s) => ({ ...newSheet(s.name), ...s, cells: s.cells ?? {}, colWidths: s.colWidths ?? {}, rowHeights: s.rowHeights ?? {} }))
  return { sheets, activeSheetId: sheets.some((s) => s.id === w.activeSheetId) ? w.activeSheetId! : sheets[0].id }
}

/** A sheet name that is not taken yet: Sheet2, Sheet3… */
export function nextSheetName(sheets: Sheet[]): string {
  for (let n = sheets.length + 1; ; n++) if (!sheets.some((s) => s.name.toLowerCase() === `sheet${n}`)) return `Sheet${n}`
}

// ---- addresses -----------------------------------------------------------------

export function colName(col: number): string {
  let s = ''
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

export const addr = (col: number, row: number) => `${colName(col)}${row + 1}`

export function parseAddr(a: string): { col: number; row: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(a.toUpperCase())
  if (!m) return null
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { col: col - 1, row: Number(m[2]) - 1 }
}

export interface Range {
  c1: number
  r1: number
  c2: number
  r2: number
}

export const normRange = (a: { col: number; row: number }, b: { col: number; row: number }): Range => ({
  c1: Math.min(a.col, b.col),
  r1: Math.min(a.row, b.row),
  c2: Math.max(a.col, b.col),
  r2: Math.max(a.row, b.row),
})

export const rangeName = (r: Range) => (r.c1 === r.c2 && r.r1 === r.r2 ? addr(r.c1, r.r1) : `${addr(r.c1, r.r1)}:${addr(r.c2, r.r2)}`)

/** Size of the grid to show: the used area plus room to grow. */
export function usedSize(sheet: Sheet): { cols: number; rows: number } {
  let cols = 0
  let rows = 0
  for (const k of Object.keys(sheet.cells)) {
    const p = parseAddr(k)
    if (!p) continue
    cols = Math.max(cols, p.col + 1)
    rows = Math.max(rows, p.row + 1)
  }
  return { cols, rows }
}

/** Sheet names with spaces or symbols need quotes in formulas: 'My sheet'!A1. */
export const sheetRef = (name: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`)

// ---- fill series (the fill handle) ----------------------------------------------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const DAYS_DE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const LISTS = [MONTHS, DAYS, MONTHS_DE, DAYS_DE, MONTHS.map((m) => m.slice(0, 3)), DAYS.map((d) => d.slice(0, 3))]

/** Dates the sheet understands, in the order they are tried. */
const DATE_PATTERNS: { re: RegExp; make(m: RegExpExecArray): Date; format(d: Date, like: string): string }[] = [
  {
    // 03.10.2026 or 3.10.26
    re: /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
    make: (m) => new Date(Date.UTC(year(m[3]), Number(m[2]) - 1, Number(m[1]))),
    format: (d, like) => `${pad(d.getUTCDate(), like.split('.')[0].length)}.${pad(d.getUTCMonth() + 1, like.split('.')[1].length)}.${like.split('.')[2].length === 2 ? String(d.getUTCFullYear()).slice(2) : d.getUTCFullYear()}`,
  },
  {
    // 2026-10-03
    re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    make: (m) => new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))),
    format: (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`,
  },
  {
    // 03/10/2026 (day first, like the rest of Europe)
    re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    make: (m) => new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))),
    format: (d) => `${pad(d.getUTCDate(), 2)}/${pad(d.getUTCMonth() + 1, 2)}/${d.getUTCFullYear()}`,
  },
]
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y))
const pad = (n: number, len: number) => String(n).padStart(len, '0')
const DAY_MS = 86400000

function asDate(v: string): { date: Date; p: (typeof DATE_PATTERNS)[number] } | null {
  for (const p of DATE_PATTERNS) {
    const m = p.re.exec(v.trim())
    if (m) {
      const date = p.make(m)
      if (!Number.isNaN(date.getTime())) return { date, p }
    }
  }
  return null
}

const isNum = (v: string) => v.trim() !== '' && Number.isFinite(Number(v.trim().replace(',', '.')))
const num = (v: string) => Number(v.trim().replace(',', '.'))
const roundish = (n: number) => Math.round(n * 1e10) / 1e10

/**
 * What dragging the fill handle over `count` more cells writes, Excel style:
 * numbers and dates continue their step (one number is copied, one date counts
 * up by a day), "Item 1" becomes "Item 2", month and weekday names keep going,
 * anything else repeats. Formulas are handled by the engine (references shift).
 */
export function fillSeries(src: string[], count: number): string[] {
  const out: string[] = []
  const n = src.length
  if (n === 0 || count <= 0) return out
  const at = (i: number) => src[i % n]

  if (src.every(isNum)) {
    if (n === 1) return Array(count).fill(src[0])
    const step = (num(src[n - 1]) - num(src[0])) / (n - 1)
    for (let i = 1; i <= count; i++) out.push(String(roundish(num(src[n - 1]) + step * i)))
    return out
  }

  const dates = src.map(asDate)
  if (dates.every(Boolean)) {
    const first = dates[0]!
    const last = dates[n - 1]!
    const stepDays = n === 1 ? 1 : Math.round((last.date.getTime() - first.date.getTime()) / DAY_MS / (n - 1))
    // A step of whole months (03.01, 03.02…) keeps the day of the month.
    const months = n > 1 && dates.every((d) => d!.date.getUTCDate() === first.date.getUTCDate()) && first.date.getUTCDate() <= 28
    const monthStep = months ? (last.date.getUTCFullYear() - first.date.getUTCFullYear()) * 12 + last.date.getUTCMonth() - first.date.getUTCMonth() : 0
    for (let i = 1; i <= count; i++) {
      const d = new Date(last.date)
      if (months && monthStep) d.setUTCMonth(d.getUTCMonth() + (monthStep / (n - 1)) * i)
      else d.setTime(last.date.getTime() + stepDays * i * DAY_MS)
      out.push(last.p.format(d, src[n - 1].trim()))
    }
    return out
  }

  const list = LISTS.find((l) => src.every((v) => l.some((x) => x.toLowerCase() === v.trim().toLowerCase())))
  if (list) {
    const idx = src.map((v) => list.findIndex((x) => x.toLowerCase() === v.trim().toLowerCase()))
    const step = n === 1 ? 1 : (((idx[n - 1] - idx[0]) / (n - 1)) % list.length + list.length) % list.length || 1
    const cased = (word: string, like: string) => (like === like.toUpperCase() ? word.toUpperCase() : like === like.toLowerCase() ? word.toLowerCase() : word)
    for (let i = 1; i <= count; i++) out.push(cased(list[(idx[n - 1] + step * i) % list.length], src[n - 1].trim()))
    return out
  }

  const trailing = src.map((v) => /^(.*?)(\d+)$/.exec(v))
  if (trailing.every((m) => m && m[1] === trailing[0]![1])) {
    const nums = trailing.map((m) => Number(m![2]))
    const step = n === 1 ? 1 : (nums[n - 1] - nums[0]) / (n - 1)
    const width = trailing[n - 1]![2].length
    for (let i = 1; i <= count; i++) {
      const v = Math.round(nums[n - 1] + step * i)
      out.push(`${trailing[0]![1]}${v < 0 ? v : String(v).padStart(width, '0')}`)
    }
    return out
  }

  for (let i = 0; i < count; i++) out.push(at(n + i))
  return out
}

// ---- display ---------------------------------------------------------------------

/** Excel's serial date (days since 30.12.1899) as DD.MM.YYYY. */
export function serialToDate(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * DAY_MS))
  return `${pad(d.getUTCDate(), 2)}.${pad(d.getUTCMonth() + 1, 2)}.${d.getUTCFullYear()}`
}

/** How a computed value shows in its cell. */
export function formatValue(value: unknown, style: CellStyle | undefined, isDate: boolean): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value !== 'number') return String(value)
  const fmt = style?.fmt ?? (isDate ? 'date' : 'general')
  const dp = style?.dp ?? 2
  switch (fmt) {
    case 'date':
      return serialToDate(value)
    case 'number':
      return value.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
    case 'percent':
      return `${(value * 100).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}%`
    case 'currency':
      return value.toLocaleString(undefined, { style: 'currency', currency: 'EUR', minimumFractionDigits: dp, maximumFractionDigits: dp })
    default:
      return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(10)))
  }
}

// ---- moving formulas -------------------------------------------------------------

/**
 * A formula copied `dc` columns and `dr` rows away, Excel style: relative
 * references move along, `$` parts stay. Text in quotes is left alone. A
 * reference pushed off the sheet becomes #REF!.
 */
export function shiftFormula(f: string, dc: number, dr: number): string {
  if (!f.startsWith('=') || (dc === 0 && dr === 0)) return f
  return f
    .split(/("(?:[^"]|"")*")/)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/(?<![A-Za-z0-9_.$])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g, (_m, ac: string, c: string, ar: string, r: string) => {
            let col = parseAddr(`${c}1`)!.col
            let row = Number(r) - 1
            if (!ac) col += dc
            if (!ar) row += dr
            if (col < 0 || row < 0) return '#REF!'
            return `${ac}${colName(col)}${ar}${row + 1}`
          }),
    )
    .join('')
}
