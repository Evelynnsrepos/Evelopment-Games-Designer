import { CellError, CellValueDetailedType, DetailedCellError, ErrorType, FunctionArgumentType, FunctionPlugin, HyperFormula, type SimpleCellAddress } from 'hyperformula'
import type { Id } from '@/core/model'
import { tryEvaluate } from '@/shared/formulas'
import { addr, parseAddr, type Cell, type Sheet, type Workbook } from './model'

/**
 * HyperFormula behind a workbook (v0.9): Excel's functions, ranges and
 * Sheet2!A1 references. `sync` hands it the workbook after every change and only
 * sends the cells that changed.
 */

// ---- CALC(): Damage Calculator presets as spreadsheet functions -------------------

export interface CalcPreset {
  name: string
  expression: string
  values: Record<string, number>
}

let presets = new Map<string, CalcPreset>()

/** The presets CALC() can use, keyed by name (case-insensitive). */
export function setCalcPresets(list: CalcPreset[]) {
  presets = new Map(list.map((p) => [p.name.trim().toLowerCase(), p]))
}
export const calcPreset = (name: string) => presets.get(name.trim().toLowerCase())

/** =CALC("Sword hit", "ATK", B2, "DEF", C2): a calculator preset, with some inputs taken from cells. */
class CalcPlugin extends FunctionPlugin {
  static implementedFunctions = {
    CALC: {
      method: 'calc',
      parameters: [
        { argumentType: FunctionArgumentType.STRING },
        { argumentType: FunctionArgumentType.STRING, optionalArg: true },
        { argumentType: FunctionArgumentType.NUMBER, optionalArg: true },
      ],
      repeatLastArgs: 2,
      isVolatile: true,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HyperFormula's plugin types are internal
  calc(ast: any, state: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).runFunction(ast.args, state, (this as any).metadata('CALC'), (name: string, ...pairs: (string | number | undefined)[]) => {
      const p = calcPreset(name)
      if (!p) return new CellError(ErrorType.NAME, `No calculator called "${name}"`)
      const values = { ...p.values }
      for (let i = 0; i + 1 < pairs.length; i += 2) if (typeof pairs[i] === 'string') values[pairs[i] as string] = Number(pairs[i + 1])
      const r = tryEvaluate(p.expression, values)
      return r.ok ? r.value : new CellError(ErrorType.VALUE, r.error.message)
    })
  }
}

let registered = false
function register() {
  if (registered) return
  HyperFormula.registerFunctionPlugin(CalcPlugin, { enGB: { CALC: 'CALC' } })
  registered = true
}

const CONFIG = {
  licenseKey: 'gpl-v3',
  dateFormats: ['DD.MM.YYYY', 'DD.MM.YY', 'YYYY-MM-DD', 'DD/MM/YYYY'],
  timeFormats: ['hh:mm', 'hh:mm:ss'],
  maxRows: 100000,
  maxColumns: 1000,
}

/** What the grid shows for one cell. */
export interface Shown {
  value: unknown
  isDate: boolean
  error: string | null
}

export class Engine {
  private hf: HyperFormula
  private applied: Workbook | null = null
  /** Our sheet id → HyperFormula's. */
  private index = new Map<Id, number>()

  constructor() {
    register()
    this.hf = HyperFormula.buildEmpty(CONFIG)
  }

  private dead = false

  /** Free the engine. A later `sync` (React's dev double mount) starts a fresh one. */
  destroy() {
    if (!this.dead) this.hf.destroy()
    this.dead = true
    this.applied = null
  }

  /** Bring HyperFormula up to date with the workbook. */
  sync(wb: Workbook) {
    const prev = this.applied
    const sameSheets = prev && prev.sheets.length === wb.sheets.length && prev.sheets.every((s, i) => s.id === wb.sheets[i].id && s.name === wb.sheets[i].name)
    if (!sameSheets) this.rebuild(wb)
    else {
      this.hf.batch(() => {
        wb.sheets.forEach((s, i) => {
          const old = prev.sheets[i]
          if (old.cells === s.cells) return
          const sheet = this.index.get(s.id)!
          for (const k of new Set([...Object.keys(old.cells), ...Object.keys(s.cells)])) {
            if (old.cells[k]?.v === s.cells[k]?.v && old.cells[k]?.s?.fmt === s.cells[k]?.s?.fmt) continue
            const p = parseAddr(k)
            if (p) this.hf.setCellContents({ sheet, col: p.col, row: p.row }, content(s.cells[k]))
          }
        })
      })
    }
    this.applied = wb
  }

  private rebuild(wb: Workbook) {
    if (!this.dead) this.hf.destroy()
    this.dead = false
    this.index.clear()
    this.hf = HyperFormula.buildEmpty(CONFIG)
    for (const s of wb.sheets) {
      const name = this.hf.addSheet(s.name)
      this.index.set(s.id, this.hf.getSheetId(name)!)
    }
    this.hf.batch(() => {
      for (const s of wb.sheets) {
        const sheet = this.index.get(s.id)!
        for (const [k, c] of Object.entries(s.cells)) {
          const p = parseAddr(k)
          if (p) this.hf.setCellContents({ sheet, col: p.col, row: p.row }, content(c))
        }
      }
    })
  }

  /** Work CALC() cells out again, e.g. after a calculator preset changed. */
  recalc() {
    if (!this.dead) this.hf.rebuildAndRecalculate()
  }

  shown(sheetId: Id, col: number, row: number): Shown {
    const sheet = this.index.get(sheetId)
    if (sheet === undefined) return { value: null, isDate: false, error: null }
    const at: SimpleCellAddress = { sheet, col, row }
    const value = this.hf.getCellValue(at)
    if (value instanceof DetailedCellError) return { value: value.value, isDate: false, error: value.message || value.value }
    const type = this.hf.getCellValueDetailedType(at)
    return { value, isDate: type === CellValueDetailedType.NUMBER_DATE || type === CellValueDetailedType.NUMBER_DATETIME, error: null }
  }

  /** Numbers of a range, for the status bar sum. */
  numbers(sheetId: Id, c1: number, r1: number, c2: number, r2: number): number[] {
    const out: number[] = []
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const v = this.shown(sheetId, c, r).value
      if (typeof v === 'number') out.push(v)
    }
    return out
  }

  /**
   * Insert or delete rows or columns in one sheet. Formulas everywhere follow
   * (HyperFormula rewrites them); returns the workbook with cells and styles moved.
   */
  structure(wb: Workbook, sheetId: Id, op: { axis: 'row' | 'col'; at: number; count: number }): Workbook {
    this.sync(wb)
    const sheet = this.index.get(sheetId)!
    const { axis, at, count } = op
    if (axis === 'row') {
      if (count > 0) this.hf.addRows(sheet, [at, count])
      else this.hf.removeRows(sheet, [at, -count])
    } else if (count > 0) this.hf.addColumns(sheet, [at, count])
    else this.hf.removeColumns(sheet, [at, -count])

    const sheets = wb.sheets.map((s) => {
      let cells: Record<string, Cell> = s.cells
      if (s.id === sheetId) {
        cells = {}
        for (const [k, c] of Object.entries(s.cells)) {
          const p = parseAddr(k)!
          const pos = axis === 'row' ? p.row : p.col
          if (count < 0 && pos >= at && pos < at - count) continue
          const moved = pos >= at ? pos + count : pos
          cells[axis === 'row' ? addr(p.col, moved) : addr(moved, p.row)] = c
        }
        const sizes = axis === 'row' ? s.rowHeights : s.colWidths
        const shifted: Record<number, number> = {}
        for (const [k, v] of Object.entries(sizes)) {
          const i = Number(k)
          if (count < 0 && i >= at && i < at - count) continue
          shifted[i >= at ? i + count : i] = v
        }
        s = axis === 'row' ? { ...s, rowHeights: shifted } : { ...s, colWidths: shifted }
      }
      // Formulas (in every sheet) come back rewritten from HyperFormula.
      const hfSheet = this.index.get(s.id)!
      const out: Record<string, Cell> = {}
      for (const [k, c] of Object.entries(cells)) {
        if (!c.v.startsWith('=')) out[k] = c
        else {
          const p = parseAddr(k)!
          const f = this.hf.getCellSerialized({ sheet: hfSheet, col: p.col, row: p.row })
          out[k] = { ...c, v: typeof f === 'string' ? f : c.v }
        }
      }
      return { ...s, cells: out }
    })
    const next = { ...wb, sheets }
    this.applied = null // the next sync rebuilds from the new workbook
    return next
  }

  /** Rename a sheet; formulas that point at it follow. */
  renameSheet(wb: Workbook, sheetId: Id, name: string): Workbook {
    this.sync(wb)
    this.hf.renameSheet(this.index.get(sheetId)!, name)
    const sheets = wb.sheets.map((s) => {
      const hfSheet = this.index.get(s.id)!
      const cells: Record<string, Cell> = {}
      for (const [k, c] of Object.entries(s.cells)) {
        if (!c.v.startsWith('=')) cells[k] = c
        else {
          const p = parseAddr(k)!
          const f = this.hf.getCellSerialized({ sheet: hfSheet, col: p.col, row: p.row })
          cells[k] = { ...c, v: typeof f === 'string' ? f : c.v }
        }
      }
      return { ...s, name: s.id === sheetId ? name : s.name, cells }
    })
    this.applied = null
    return { ...wb, sheets }
  }

  /** Is this a formula HyperFormula understands? */
  isValidFormula(f: string) {
    return this.hf.validateFormula(f)
  }
}

/** Raw input → what HyperFormula gets; "text" format keeps numbers as text. */
function content(c: Cell | undefined): string | null {
  if (!c || c.v === '') return null
  if (c.s?.fmt === 'text' && !c.v.startsWith('=')) return `'${c.v}`
  return c.v
}

export type { Sheet }
