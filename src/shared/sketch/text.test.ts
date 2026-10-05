import { describe, expect, it } from 'vitest'
import { cssFont, defaultText, fontName, layoutText, normalizeText, splitFontFile, wrap } from './text'

// Every letter is 10 px wide.
const measure = (s: string) => [...s].length * 10

describe('text layout', () => {
  it('wraps at word boundaries and splits long words', () => {
    expect(wrap('aaa bbb ccc', 75, measure)).toEqual(['aaa bbb', 'ccc'])
    expect(wrap('abcdefgh', 30, measure)).toEqual(['abc', 'def', 'gh'])
    expect(wrap('short', 0, measure)).toEqual(['short'])
  })

  it('aligns lines in the box and stacks them by leading', () => {
    const t = { ...defaultText(100, 50, 20, '#000'), text: 'ab\nabcd', align: 'right' as const, leading: 1.5 }
    const l = layoutText(t, measure)
    expect(l.box).toEqual({ x: 100, y: 50, w: 40, h: 50 })
    expect(l.runs.map((r) => [r.x, r.y])).toEqual([
      [120, 66],
      [100, 96],
    ])
  })

  it('applies all caps, baseline shift and underline', () => {
    const l = layoutText({ ...defaultText(0, 0, 20, '#000'), text: 'hi', caps: true, baseline: 4, underline: true }, measure)
    expect(l.runs[0].text).toBe('HI')
    expect(l.runs[0].y).toBe(12)
    expect(l.lines).toHaveLength(1)
  })

  it('stacks vertical text in columns from right to left', () => {
    const l = layoutText({ ...defaultText(0, 0, 10, '#000'), text: 'ab\nc', vertical: true, leading: 2 }, measure)
    expect(l.box.w).toBe(40)
    expect(l.runs.map((r) => [r.text, r.x, r.y])).toEqual([
      ['a', 30, 8],
      ['b', 30, 18],
      ['c', 10, 8],
    ])
  })

  it('normalizes broken saved settings and builds a CSS font', () => {
    const t = normalizeText({ size: Number.NaN, align: 'x' as never, leading: 99, font: '' })
    expect(t.size).toBe(64)
    expect(t.align).toBe('left')
    expect(t.leading).toBe(5)
    expect(cssFont({ ...t, font: 'My "Font"', bold: true })).toBe('bold 64px "My Font", sans-serif')
    expect(cssFont({ ...t, font: 'serif' })).toBe('64px serif')
  })
})

/** A tiny font: a table directory with a `name` table holding `name` (Windows, English, full name). */
function fakeFont(name: string, base = 0): { dir: Uint8Array; table: Uint8Array } {
  const utf16 = [...name].flatMap((c) => [0, c.charCodeAt(0)])
  const table = new Uint8Array(6 + 12 + utf16.length)
  const t = new DataView(table.buffer)
  t.setUint16(2, 1)
  t.setUint16(4, 18)
  ;[3, 1, 0x409, 4, utf16.length, 0].forEach((v, i) => t.setUint16(6 + i * 2, v))
  table.set(utf16, 18)
  const dir = new Uint8Array(12 + 16)
  const d = new DataView(dir.buffer)
  d.setUint32(0, 0x00010000)
  d.setUint16(4, 1)
  dir.set([...'name'].map((c) => c.charCodeAt(0)), 12)
  d.setUint32(12 + 8, base)
  d.setUint32(12 + 12, table.length)
  return { dir, table }
}

describe('font files', () => {
  it('reads the name of a single font', () => {
    const { dir, table } = fakeFont('Test Sans', 28)
    const file = new Uint8Array(28 + table.length)
    file.set(dir)
    file.set(table, 28)
    expect(splitFontFile(file)).toEqual([file])
    expect(fontName(file)).toBe('Test Sans')
  })

  it('splits a collection into standalone fonts', () => {
    const a = fakeFont('Alpha')
    const b = fakeFont('Beta')
    // ttcf header (12 + 2*4), two directories (28 each), then the two tables.
    const tablesAt = 20 + 56
    const aDir = fakeFont('Alpha', tablesAt).dir
    const bDir = fakeFont('Beta', tablesAt + a.table.length).dir
    const file = new Uint8Array(tablesAt + a.table.length + b.table.length)
    const v = new DataView(file.buffer)
    file.set([...'ttcf'].map((c) => c.charCodeAt(0)))
    v.setUint32(8, 2)
    v.setUint32(12, 20)
    v.setUint32(16, 48)
    file.set(aDir, 20)
    file.set(bDir, 48)
    file.set(a.table, tablesAt)
    file.set(b.table, tablesAt + a.table.length)
    const fonts = splitFontFile(file)
    expect(fonts.map(fontName)).toEqual(['Alpha', 'Beta'])
    expect(new DataView(fonts[1].buffer).getUint32(12 + 8)).toBe(28)
  })

  it('gives null for garbage', () => {
    expect(fontName(new Uint8Array(3))).toBeNull()
  })
})
