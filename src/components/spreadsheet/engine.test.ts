import { describe, expect, it } from 'vitest'
import { Engine, setCalcPresets } from './engine'
import { newSheet, type Workbook } from './model'

function book(): Workbook {
  const a = { ...newSheet('Sheet1'), cells: { A1: { v: '2' }, A2: { v: '3' }, A3: { v: '=SUM(A1:A2)' }, B1: { v: '03.10.2026' } } }
  const b = { ...newSheet('Loot'), cells: { A1: { v: '=Sheet1!A3*10' } } }
  return { sheets: [a, b], activeSheetId: a.id }
}

describe('spreadsheet engine', () => {
  it('works out formulas across sheets and recognises dates', () => {
    const e = new Engine()
    const wb = book()
    e.sync(wb)
    expect(e.shown(wb.sheets[0].id, 0, 2).value).toBe(5)
    expect(e.shown(wb.sheets[1].id, 0, 0).value).toBe(50)
    expect(e.shown(wb.sheets[0].id, 1, 0).isDate).toBe(true)
    const next = { ...wb, sheets: [{ ...wb.sheets[0], cells: { ...wb.sheets[0].cells, A1: { v: '10' } } }, wb.sheets[1]] }
    e.sync(next)
    expect(e.shown(wb.sheets[1].id, 0, 0).value).toBe(130)
    expect(e.shown(wb.sheets[0].id, 3, 3).value).toBe(null)
  })

  it('moves formulas when rows are inserted and sheets renamed', () => {
    const e = new Engine()
    let wb = book()
    wb = e.structure(wb, wb.sheets[0].id, { axis: 'row', at: 0, count: 1 })
    expect(wb.sheets[0].cells.A4.v).toBe('=SUM(A2:A3)')
    expect(wb.sheets[1].cells.A1.v).toBe('=Sheet1!A4*10')
    wb = e.renameSheet(wb, wb.sheets[0].id, 'Stats')
    expect(wb.sheets[1].cells.A1.v).toBe('=Stats!A4*10')
    e.sync(wb)
    expect(e.shown(wb.sheets[1].id, 0, 0).value).toBe(50)
  })

  it('runs calculator presets with CALC()', () => {
    setCalcPresets([{ name: 'Hit', expression: 'ATK * 2 - DEF', values: { ATK: 10, DEF: 4 } }])
    const e = new Engine()
    const s = { ...newSheet('Sheet1'), cells: { A1: { v: '50' }, B1: { v: '=CALC("Hit")' }, B2: { v: '=CALC("hit", "ATK", A1)' }, B3: { v: '=CALC("Nope")' } } }
    e.sync({ sheets: [s], activeSheetId: s.id })
    expect(e.shown(s.id, 1, 0).value).toBe(16)
    expect(e.shown(s.id, 1, 1).value).toBe(96)
    expect(e.shown(s.id, 1, 2).error).toMatch(/Nope/)
  })
})
