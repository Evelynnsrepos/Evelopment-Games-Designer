import { brushReach, colorStroke, compositeStroke, scaledBrush, StrokeStamper, type BrushSettings } from './brushes'

/**
 * One brush stroke as a picture, for vector canvases (Moodboard, Brainstorm, map)
 * that keep their pen strokes as points but draw them with the Sketch brushes.
 */

/** Largest side of the stroke picture; longer strokes are drawn smaller and scaled up. */
const MAX_SIDE = 4096

export interface BrushStrokeImage {
  canvas: HTMLCanvasElement
  /** Where the picture's top left sits, in the stroke's own coordinates. */
  x: number
  y: number
  /** Picture pixels per stroke unit (below 1 for very long strokes). */
  scale: number
}

/** `points` are x, y pairs; `pressures` one 0..1 value per pair (missing = full). `size` replaces the brush size. */
export function renderBrushStroke(points: number[], pressures: number[] | undefined, brush: BrushSettings, color: string, size: number): BrushStrokeImage | null {
  if (points.length < 2) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    x0 = Math.min(x0, points[i])
    x1 = Math.max(x1, points[i])
    y0 = Math.min(y0, points[i + 1])
    y1 = Math.max(y1, points[i + 1])
  }
  const sized = { ...scaledBrush(brush, size / Math.max(1, brush.size)), stabilization: 0, motionFilter: 0, tipAnimation: false }
  const pad = brushReach(sized)
  const scale = Math.min(1, MAX_SIDE / Math.max(x1 - x0 + 2 * pad, y1 - y0 + 2 * pad))
  const b = scaledBrush(sized, scale)
  const w = Math.max(1, Math.ceil((x1 - x0 + 2 * pad) * scale))
  const h = Math.max(1, Math.ceil((y1 - y0 + 2 * pad) * scale))
  const make = () => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  const mask = make()
  const s = new StrokeStamper(mask.getContext('2d')!, b, undefined, 7, color)
  for (let i = 0; i < points.length; i += 2)
    s.add({ x: (points[i] - x0 + pad) * scale, y: (points[i + 1] - y0 + pad) * scale, pressure: pressures?.[i / 2] ?? 1, time: i * 4 })
  s.finish()
  const paint = make()
  colorStroke(mask, paint.getContext('2d')!, color, b)
  const out = make()
  compositeStroke(out.getContext('2d')!, paint, { ...b, blend: 'source-over', luminanceBlend: false }, { erase: false, alphaLock: false, selection: null })
  return { canvas: out, x: x0 - pad, y: y0 - pad, scale }
}
