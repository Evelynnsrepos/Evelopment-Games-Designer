/**
 * QuickShape (v0.5), like Procreate's: draw a rough shape, keep holding at the
 * end, and it snaps to a clean line, polyline, triangle, rectangle, circle or
 * ellipse. Pure geometry, no canvas.
 */

export interface Pt {
  x: number
  y: number
}

export type ShapeKind = 'line' | 'polyline' | 'triangle' | 'rectangle' | 'quad' | 'circle' | 'ellipse'

export interface Shape {
  kind: ShapeKind
  /** Corner points (line/polyline/polygons) or [center, radius x/y as a point] for ellipses. */
  points: Pt[]
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

function segDist(p: Pt, a: Pt, b: Pt): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (!l2) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2))
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
}

/** Ramer-Douglas-Peucker: the corners of a rough line. */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts
  let max = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], pts[0], pts[pts.length - 1])
    if (d > max) {
      max = d
      idx = i
    }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]]
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)]
}

function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

const pathLength = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0)

/** The clean shape for a rough stroke, or null if it is too small or too wiggly to guess. */
export function recognize(pts: Pt[]): Shape | null {
  if (pts.length < 2) return null
  const b = bounds(pts)
  const diag = Math.hypot(b.w, b.h)
  if (diag < 8) return null
  const start = pts[0]
  const end = pts[pts.length - 1]
  const length = pathLength(pts)

  // Open strokes: a straight line, or a few straight segments.
  const closed = dist(start, end) < Math.max(12, diag * 0.22) && length > diag * 1.6
  if (!closed) {
    const straight = Math.max(...pts.map((p) => segDist(p, start, end)))
    if (straight < Math.max(4, dist(start, end) * 0.08)) return { kind: 'line', points: [start, end] }
    const corners = simplify(pts, diag * 0.06)
    if (corners.length <= 5) return { kind: 'polyline', points: corners }
    return null
  }

  // Closed and round (every point near the ellipse of the bounding box): circle or ellipse.
  const rx = b.w / 2
  const ry = b.h / 2
  const cx = b.x + rx
  const cy = b.y + ry
  const roundness = pts.reduce((s, p) => s + Math.abs(Math.hypot((p.x - cx) / (rx || 1), (p.y - cy) / (ry || 1)) - 1), 0) / pts.length
  if (roundness < 0.1) {
    if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.18) {
      const r = (rx + ry) / 2
      return { kind: 'circle', points: [{ x: cx, y: cy }, { x: r, y: r }] }
    }
    return { kind: 'ellipse', points: [{ x: cx, y: cy }, { x: rx, y: ry }] }
  }

  // Closed strokes: count corners on the loop (start and end joined).
  const loop = [...pts, start]
  let corners = simplify(loop, diag * 0.09).slice(0, -1)
  // Merge corners that ended up next to each other at the seam.
  corners = corners.filter((c, i) => i === 0 || dist(c, corners[i - 1]) > diag * 0.12)
  if (corners.length > 1 && dist(corners[0], corners[corners.length - 1]) < diag * 0.12) corners = corners.slice(0, -1)

  if (corners.length === 3) return { kind: 'triangle', points: corners }
  if (corners.length === 4) {
    // Nearly square corners and nearly level sides: a clean rectangle on the bounding box.
    const level = corners.every((c, i) => {
      const n = corners[(i + 1) % 4]
      const a = Math.abs(Math.atan2(n.y - c.y, n.x - c.x)) % (Math.PI / 2)
      return Math.min(a, Math.PI / 2 - a) < 0.2
    })
    if (level) {
      const r = bounds(corners)
      return { kind: 'rectangle', points: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }] }
    }
    return { kind: 'quad', points: corners }
  }

  // Many corners but not round enough: keep it as the cleaned-up polygon.
  return corners.length >= 5 && corners.length <= 8 ? { kind: 'quad', points: corners } : null
}

/** Points along the shape, about every `step` px, starting where the user started. */
export function outline(shape: Shape, step = 2, startNear?: Pt): Pt[] {
  const out: Pt[] = []
  const along = (a: Pt, b: Pt) => {
    const n = Math.max(1, Math.ceil(dist(a, b) / step))
    for (let i = 0; i < n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })
  }
  const p = shape.points
  if (shape.kind === 'circle' || shape.kind === 'ellipse') {
    const [c, r] = p
    const a0 = startNear ? Math.atan2((startNear.y - c.y) / (r.y || 1), (startNear.x - c.x) / (r.x || 1)) : 0
    const n = Math.max(24, Math.ceil((Math.PI * 2 * Math.max(r.x, r.y)) / step))
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * Math.PI * 2
      out.push({ x: c.x + Math.cos(a) * r.x, y: c.y + Math.sin(a) * r.y })
    }
    return out
  }
  const closed = shape.kind !== 'line' && shape.kind !== 'polyline'
  const pts = closed ? [...p, p[0]] : p
  for (let i = 0; i < pts.length - 1; i++) along(pts[i], pts[i + 1])
  out.push(pts[pts.length - 1])
  return out
}

/** Resize while still holding: lines follow the pointer, other shapes scale around their center. */
export function resize(shape: Shape, from: Pt, to: Pt): Shape {
  const p = shape.points
  if (shape.kind === 'line') return { ...shape, points: [p[0], to] }
  if (shape.kind === 'polyline') return { ...shape, points: [...p.slice(0, -1), to] }
  const c = shape.kind === 'circle' || shape.kind === 'ellipse' ? p[0] : { x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length }
  const k = dist(to, c) / Math.max(1, dist(from, c))
  if (shape.kind === 'circle' || shape.kind === 'ellipse') return { ...shape, points: [c, { x: p[1].x * k, y: p[1].y * k }] }
  return { ...shape, points: p.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k })) }
}

const snapAngle = (a: Pt, b: Pt, stepDeg = 15): Pt => {
  const len = dist(a, b)
  const step = (stepDeg * Math.PI) / 180
  const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / step) * step
  return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len }
}

/**
 * The "perfect" version (Shift, like Procreate's second-finger tap): lines snap
 * to 15° steps, ellipses become circles, rectangles squares, triangles equilateral.
 */
export function perfect(shape: Shape): Shape {
  const p = shape.points
  switch (shape.kind) {
    case 'line':
      return { ...shape, points: [p[0], snapAngle(p[0], p[1])] }
    case 'polyline': {
      const out = [p[0]]
      for (let i = 1; i < p.length; i++) out.push(snapAngle(out[i - 1], p[i]))
      return { ...shape, points: out }
    }
    case 'ellipse':
    case 'circle': {
      const r = (p[1].x + p[1].y) / 2
      return { kind: 'circle', points: [p[0], { x: r, y: r }] }
    }
    case 'rectangle':
    case 'quad': {
      const c = { x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length }
      const half = p.reduce((s, q) => s + Math.max(Math.abs(q.x - c.x), Math.abs(q.y - c.y)), 0) / p.length
      return {
        kind: 'rectangle',
        points: [
          { x: c.x - half, y: c.y - half },
          { x: c.x + half, y: c.y - half },
          { x: c.x + half, y: c.y + half },
          { x: c.x - half, y: c.y + half },
        ],
      }
    }
    case 'triangle': {
      const c = { x: (p[0].x + p[1].x + p[2].x) / 3, y: (p[0].y + p[1].y + p[2].y) / 3 }
      const r = (dist(p[0], c) + dist(p[1], c) + dist(p[2], c)) / 3
      // Point up, like a drawn warning sign.
      return { kind: 'triangle', points: [0, 1, 2].map((i) => ({ x: c.x + Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 3) * r, y: c.y + Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 3) * r })) }
    }
  }
}

/** Shift is tracked app-wide so tools can ask for the perfect shape without a key event of their own. */
export const keys = { shift: false }
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => e.key === 'Shift' && (keys.shift = true))
  window.addEventListener('keyup', (e) => e.key === 'Shift' && (keys.shift = false))
  window.addEventListener('blur', () => (keys.shift = false))
}

/** How long the pointer must rest at the end of a stroke before it snaps. */
export const HOLD_MS = 550
