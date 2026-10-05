/**
 * Canvas changes, drawing statistics and time-lapse timing (Sketch Pro). Pure.
 */

/** Largest canvas side, same as the size picker. */
export const MAX_SIDE = 8192

/** A new canvas size and where the old picture lands on it: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export interface CanvasChange {
  width: number
  height: number
  matrix: [number, number, number, number, number, number]
}

/** 0..8, row by row: 0 = top left, 4 = centre, 8 = bottom right. */
export type Anchor = number

const side = (v: number) => Math.max(1, Math.min(MAX_SIDE, Math.round(v) || 1))

/**
 * Change the canvas size. With `resample` the picture is scaled to the new size;
 * without, it keeps its pixels and is cut or padded around the anchor.
 */
export function resizeCanvas(w: number, h: number, width: number, height: number, anchor: Anchor, resample: boolean): CanvasChange {
  width = side(width)
  height = side(height)
  if (resample) return { width, height, matrix: [width / w, 0, 0, height / h, 0, 0] }
  const col = anchor % 3
  const row = Math.floor(anchor / 3)
  return { width, height, matrix: [1, 0, 0, 1, Math.round(((width - w) * col) / 2), Math.round(((height - h) * row) / 2)] }
}

/** Cut the canvas to a rectangle (clipped to the canvas); null when nothing is left. */
export function cropCanvas(w: number, h: number, r: { x: number; y: number; w: number; h: number }): CanvasChange | null {
  const x0 = Math.max(0, Math.floor(r.x))
  const y0 = Math.max(0, Math.floor(r.y))
  const x1 = Math.min(w, Math.ceil(r.x + r.w))
  const y1 = Math.min(h, Math.ceil(r.y + r.h))
  if (x1 - x0 < 1 || y1 - y0 < 1) return null
  return { width: x1 - x0, height: y1 - y0, matrix: [1, 0, 0, 1, -x0, -y0] }
}

/** Mirror the whole picture. */
export function flipCanvas(w: number, h: number, axis: 'x' | 'y'): CanvasChange {
  return { width: w, height: h, matrix: axis === 'x' ? [-1, 0, 0, 1, w, 0] : [1, 0, 0, -1, 0, h] }
}

/** Turn the whole picture a quarter turn (the canvas swaps width and height). */
export function rotateCanvas(w: number, h: number, dir: 1 | -1): CanvasChange {
  return { width: h, height: w, matrix: dir === 1 ? [0, 1, -1, 0, h, 0] : [0, -1, 1, 0, 0, w] }
}

/** Where a canvas point ends up after a change (for guides and selections). */
export function mapPoint(c: CanvasChange, p: { x: number; y: number }) {
  const [a, b, cc, d, e, f] = c.matrix
  return { x: a * p.x + cc * p.y + e, y: b * p.x + d * p.y + f }
}

// ---- Statistics -----------------------------------------------------------------

/** Counted on the drawing itself (optional fields, missing = 0). */
export interface DrawingStats {
  strokes: number
  /** ms spent drawing: time between strokes counts, up to a short break. */
  timeMs: number
}

/** A pause longer than this is a break, not drawing time. */
export const BREAK_MS = 30_000
/** Time counted for a stroke with nothing before it. */
export const FIRST_STROKE_MS = 1_000

export function addStroke(s: DrawingStats | undefined, now: number, lastStroke: number | null): DrawingStats {
  const gap = lastStroke === null ? FIRST_STROKE_MS : Math.min(BREAK_MS, Math.max(0, now - lastStroke))
  return { strokes: (s?.strokes ?? 0) + 1, timeMs: (s?.timeMs ?? 0) + gap }
}

/** "2 h 05 min", "12 min", "40 s". */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

// ---- Time-lapse -------------------------------------------------------------------

export const TIMELAPSE_EVERY = 4
/** Longest side of a recorded frame. */
export const TIMELAPSE_SIDE = 720
export const REPLAY_FPS = 30
/** The finished picture stays this long at the end of an export. */
export const HOLD_MS = 2_000

/** True when this stroke count should record a frame. */
export const shouldRecord = (strokes: number, every = TIMELAPSE_EVERY) => strokes > 0 && strokes % Math.max(1, every) === 0

/** Frame size that fits `max` on the longest side, even numbers (video encoders like those). */
export function fitSize(w: number, h: number, max = TIMELAPSE_SIDE): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(w, h))
  const even = (v: number) => Math.max(2, Math.round((v * k) / 2) * 2)
  return { width: even(w), height: even(h) }
}

/**
 * Which recorded frames to show and for how long. 'full' plays every frame at
 * REPLAY_FPS; 'short' fits the replay into 30 seconds (dropping frames when there
 * are too many, slowing down when there are few). The last entry (index -1) is
 * the finished picture, held for HOLD_MS.
 */
export function replayPlan(frames: number, mode: 'full' | 'short', fps = REPLAY_FPS): { index: number; ms: number }[] {
  const step = 1000 / fps
  const out: { index: number; ms: number }[] = []
  if (mode === 'full' || frames === 0) for (let i = 0; i < frames; i++) out.push({ index: i, ms: step })
  else {
    const room = 30_000 - HOLD_MS
    const n = Math.min(frames, Math.floor(room / step))
    const ms = Math.min(500, room / n)
    for (let i = 0; i < n; i++) out.push({ index: n === 1 ? frames - 1 : Math.round((i * (frames - 1)) / (n - 1)), ms })
  }
  out.push({ index: -1, ms: HOLD_MS })
  return out
}
