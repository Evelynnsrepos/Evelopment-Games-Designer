/**
 * Text layers (Sketch Pro). A text layer is a normal pixel layer with a `text`
 * field; whenever the settings change the text is drawn again into the
 * layer's canvas, so it goes through the same layer pipeline as paint.
 * "Rasterize" just drops the field and keeps the pixels.
 */

export interface SketchText {
  text: string
  /** CSS font family: a system font, an imported font or a generic one. */
  font: string
  /** Font size in canvas pixels. */
  size: number
  color: string
  bold: boolean
  italic: boolean
  /** Top-left corner of the text box, in canvas pixels. */
  x: number
  y: number
  /** Wrap lines at this width; 0 = no wrapping. */
  width: number
  align: 'left' | 'center' | 'right'
  /** Use the font's own kerning pairs. */
  kerning: boolean
  /** Extra space between letters, in % of the size. */
  tracking: number
  /** Line spacing as a multiple of the size. */
  leading: number
  /** Lifts the text (negative lowers it), in canvas pixels. */
  baseline: number
  underline: boolean
  /** Outline width in canvas pixels; 0 = none. */
  outline: number
  outlineColor: string
  /** Letters stacked top to bottom, columns from right to left. */
  vertical: boolean
  caps: boolean
}

export const defaultText = (x: number, y: number, size: number, color: string): SketchText => ({
  text: 'Text',
  font: 'sans-serif',
  size,
  color,
  bold: false,
  italic: false,
  x,
  y,
  width: 0,
  align: 'left',
  kerning: true,
  tracking: 0,
  leading: 1.2,
  baseline: 0,
  underline: false,
  outline: 0,
  outlineColor: '#ffffff',
  vertical: false,
  caps: false,
})

/** Fill in missing or broken fields of a saved text (older or hand-edited drawings). */
export function normalizeText(t: Partial<SketchText>): SketchText {
  const d = defaultText(0, 0, 64, '#111111')
  const num = (v: unknown, def: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def)
  return {
    ...d,
    ...t,
    text: typeof t.text === 'string' ? t.text : d.text,
    font: typeof t.font === 'string' && t.font.trim() ? t.font : d.font,
    size: num(t.size, d.size, 1, 2000),
    x: num(t.x, 0, -1e5, 1e5),
    y: num(t.y, 0, -1e5, 1e5),
    width: num(t.width, 0, 0, 1e5),
    tracking: num(t.tracking, 0, -100, 500),
    leading: num(t.leading, d.leading, 0.3, 5),
    baseline: num(t.baseline, 0, -1e4, 1e4),
    outline: num(t.outline, 0, 0, 500),
    align: t.align === 'center' || t.align === 'right' ? t.align : 'left',
  }
}

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'])

/** The CSS font string for a text. Unknown fonts fall back to sans-serif. */
export function cssFont(t: Pick<SketchText, 'font' | 'size' | 'bold' | 'italic'>): string {
  const family = GENERIC.has(t.font) ? t.font : `"${t.font.replace(/"/g, '')}", sans-serif`
  return `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.size}px ${family}`
}

/** One piece of text to draw with its left (or, vertical, center) at x and its baseline at y. */
export interface TextRun {
  text: string
  x: number
  y: number
  w: number
}

export interface TextLayout {
  runs: TextRun[]
  /** Underlines (or side lines for vertical text), as x0,y0 -> x1,y1. */
  lines: [number, number, number, number][]
  box: { x: number; y: number; w: number; h: number }
}

/** Break a paragraph into lines no wider than `max` (words longer than a line are split by letters). */
export function wrap(paragraph: string, max: number, measure: (s: string) => number): string[] {
  if (max <= 0 || measure(paragraph) <= max) return [paragraph]
  const out: string[] = []
  let line = ''
  for (const word of paragraph.split(/(?<=\s)/)) {
    const next = line + word
    if (!line || measure(next.trimEnd()) <= max) {
      line = next
      continue
    }
    out.push(line.trimEnd())
    line = word
  }
  // Split what is still too wide letter by letter.
  return [...out, line.trimEnd()].flatMap((l) => {
    if (measure(l) <= max) return [l]
    const parts: string[] = []
    let cur = ''
    for (const ch of l) {
      if (cur && measure(cur + ch) > max) {
        parts.push(cur)
        cur = ''
      }
      cur += ch
    }
    return [...parts, cur]
  })
}

/** Where each line or letter goes. `measure` gives the width of a string with tracking included. */
export function layoutText(t: SketchText, measure: (s: string) => number): TextLayout {
  const content = t.caps ? t.text.toUpperCase() : t.text
  const paragraphs = content.split('\n')
  const step = t.size * t.leading
  const ascent = t.size * 0.8
  const lineW = Math.max(1, t.size / 16)
  const runs: TextRun[] = []
  const lines: TextLayout['lines'] = []
  if (t.vertical) {
    // Each paragraph is a column, right to left; each letter is one row.
    const advance = t.size * (1 + t.tracking / 100)
    const cols = paragraphs.map((p) => [...p])
    const tallest = Math.max(1, ...cols.map((c) => c.length)) * advance
    const w = Math.max(1, cols.length) * step
    cols.forEach((chars, i) => {
      const cx = t.x + w - step * (i + 0.5)
      const h = chars.length * advance
      const top = t.y + (t.align === 'center' ? (tallest - h) / 2 : t.align === 'right' ? tallest - h : 0)
      chars.forEach((ch, j) => runs.push({ text: ch, x: cx, y: top + j * advance + ascent - t.baseline, w: measure(ch) }))
      if (t.underline && chars.length) {
        const lx = cx + t.size * 0.6
        lines.push([lx, top - t.baseline, lx, top + h - t.baseline])
      }
    })
    return { runs, lines, box: { x: t.x, y: t.y, w, h: tallest } }
  }
  const rows = paragraphs.flatMap((p) => wrap(p, t.width, measure))
  const widths = rows.map(measure)
  const w = t.width > 0 ? t.width : Math.max(1, ...widths)
  rows.forEach((text, i) => {
    const x = t.x + (t.align === 'center' ? (w - widths[i]) / 2 : t.align === 'right' ? w - widths[i] : 0)
    const y = t.y + i * step + ascent - t.baseline
    runs.push({ text, x, y, w: widths[i] })
    if (t.underline && text.trim()) lines.push([x, y + lineW * 2, x + widths[i], y + lineW * 2])
  })
  return { runs, lines, box: { x: t.x, y: t.y, w, h: (rows.length - 1) * step + t.size } }
}

/** Measure with the canvas, tracking included (no trailing gap after the last letter). */
function measurer(ctx: CanvasRenderingContext2D, t: SketchText) {
  const track = (t.size * t.tracking) / 100
  // ponytail: webviews without canvas letterSpacing draw horizontal text without tracking.
  return (s: string) => ctx.measureText(s).width - (s && 'letterSpacing' in ctx ? track : 0)
}

/** Draw a text into `ctx` (the layer canvas, already cleared). */
export function drawText(ctx: CanvasRenderingContext2D, t: SketchText): TextLayout {
  ctx.save()
  ctx.font = cssFont(t)
  ctx.textBaseline = 'alphabetic'
  ctx.fontKerning = t.kerning ? 'normal' : 'none'
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(t.size * t.tracking) / 100}px`
  const layout = layoutText(t, measurer(ctx, t))
  ctx.textAlign = t.vertical ? 'center' : 'left'
  ctx.lineJoin = 'round'
  if (t.outline > 0) {
    // Outline behind the fill, so its full width shows outside the letters.
    ctx.strokeStyle = t.outlineColor
    ctx.lineWidth = t.outline * 2
    for (const r of layout.runs) ctx.strokeText(r.text, r.x, r.y)
    if (layout.lines.length) strokeLines(ctx, layout.lines, Math.max(1, t.size / 16) + t.outline * 2)
  }
  ctx.fillStyle = t.color
  for (const r of layout.runs) ctx.fillText(r.text, r.x, r.y)
  if (layout.lines.length) {
    ctx.strokeStyle = t.color
    strokeLines(ctx, layout.lines, Math.max(1, t.size / 16))
  }
  ctx.restore()
  return layout
}

function strokeLines(ctx: CanvasRenderingContext2D, lines: TextLayout['lines'], width: number) {
  ctx.lineWidth = width
  ctx.lineCap = 'butt'
  ctx.beginPath()
  for (const [x0, y0, x1, y1] of lines) {
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
  }
  ctx.stroke()
}

// ---- Font files ----------------------------------------------------------------

const tag = (v: DataView, at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3))

/**
 * The fonts inside a font file as standalone TTF/OTF files. A TTC collection
 * holds several fonts that share tables; each one is copied out with its own
 * tables, because the browser's font loader only takes single fonts.
 */
export function splitFontFile(bytes: Uint8Array): Uint8Array[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 12 || tag(v, 0) !== 'ttcf') return [bytes]
  const count = Math.min(v.getUint32(8), 256)
  const out: Uint8Array[] = []
  for (let f = 0; f < count; f++) {
    const at = v.getUint32(12 + f * 4)
    const n = v.getUint16(at + 4)
    const tables = Array.from({ length: n }, (_, i) => {
      const r = at + 12 + i * 16
      return { rec: bytes.subarray(r, r + 16), offset: v.getUint32(r + 8), length: v.getUint32(r + 12) }
    })
    let size = 12 + n * 16
    const placed = tables.map((t) => {
      const p = size
      size += (t.length + 3) & ~3
      return p
    })
    const font = new Uint8Array(size)
    const w = new DataView(font.buffer)
    font.set(bytes.subarray(at, at + 12), 0)
    tables.forEach((t, i) => {
      font.set(t.rec, 12 + i * 16)
      w.setUint32(12 + i * 16 + 8, placed[i])
      font.set(bytes.subarray(t.offset, t.offset + t.length), placed[i])
    })
    out.push(font)
  }
  return out
}

/** The font's full name (or family) from its `name` table, or null. */
export function fontName(bytes: Uint8Array): string | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  try {
    const n = v.getUint16(4)
    let table = -1
    for (let i = 0; i < n; i++) if (tag(v, 12 + i * 16) === 'name') table = v.getUint32(12 + i * 16 + 8)
    if (table < 0) return null
    const count = v.getUint16(table + 2)
    const strings = table + v.getUint16(table + 4)
    let best: { score: number; text: string } | null = null
    for (let i = 0; i < count; i++) {
      const r = table + 6 + i * 12
      const [platform, , lang, id, len, off] = [0, 2, 4, 6, 8, 10].map((k) => v.getUint16(r + k))
      if (id !== 4 && id !== 1) continue
      const at = strings + off
      let text = ''
      if (platform === 3 || platform === 0) for (let k = 0; k + 1 < len; k += 2) text += String.fromCharCode(v.getUint16(at + k))
      else if (platform === 1) for (let k = 0; k < len; k++) text += String.fromCharCode(v.getUint8(at + k))
      else continue
      // Full name over family; Windows English over the rest.
      const score = (id === 4 ? 4 : 0) + (platform === 3 ? 2 : 0) + (lang === 0x409 || lang === 0 ? 1 : 0)
      if (text.trim() && (!best || score > best.score)) best = { score, text: text.trim() }
    }
    return best?.text ?? null
  } catch {
    return null
  }
}
