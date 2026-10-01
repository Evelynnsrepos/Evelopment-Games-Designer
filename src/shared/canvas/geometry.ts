import type { Point, Rect, Viewport } from './types'

/** Pure viewport and rectangle math, shared by the engine and canvas components. */

export const MIN_SCALE = 0.05
export const MAX_SCALE = 8

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function screenToWorld(p: Point, v: Viewport): Point {
  return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale }
}

export function worldToScreen(p: Point, v: Viewport): Point {
  return { x: p.x * v.scale + v.x, y: p.y * v.scale + v.y }
}

/** Zoom by `factor` keeping the world point under `screenPoint` fixed (wheel zoom at cursor). */
export function zoomAt(v: Viewport, screenPoint: Point, factor: number): Viewport {
  const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
  const world = screenToWorld(screenPoint, v)
  return { scale, x: screenPoint.x - world.x * scale, y: screenPoint.y - world.y * scale }
}

/** Viewport that shows `rect` centered in a screen of `size`, never zooming in past `maxScale`. */
export function fitRect(rect: Rect, size: { width: number; height: number }, padding = 40, maxScale = 1): Viewport {
  const w = Math.max(1, size.width - padding * 2)
  const h = Math.max(1, size.height - padding * 2)
  const scale = clamp(Math.min(w / Math.max(rect.width, 1), h / Math.max(rect.height, 1), maxScale), MIN_SCALE, MAX_SCALE)
  return {
    scale,
    x: size.width / 2 - (rect.x + rect.width / 2) * scale,
    y: size.height / 2 - (rect.y + rect.height / 2) * scale,
  }
}

/** Rectangle spanned by two corner points, in any order. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
}

export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

export function rectContainsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.width)
    y2 = Math.max(y2, r.y + r.height)
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, width: r.width + by * 2, height: r.height + by * 2 }
}

/** Bounds of points given as a flat [x0, y0, x1, y1, ...] list. */
export function pointsBounds(points: number[]): Rect {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (let i = 0; i + 1 < points.length; i += 2) {
    x1 = Math.min(x1, points[i])
    y1 = Math.min(y1, points[i + 1])
    x2 = Math.max(x2, points[i])
    y2 = Math.max(y2, points[i + 1])
  }
  if (x1 === Infinity) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

/**
 * Axis-aligned world bounds of a local rect after Konva's node transform
 * (scale, then rotate, then translate to x/y).
 */
export function transformBounds(local: Rect, t: { x: number; y: number; rotation?: number; scaleX?: number; scaleY?: number }): Rect {
  const sx = t.scaleX ?? 1
  const sy = t.scaleY ?? 1
  const rad = ((t.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const corners = [
    [local.x, local.y],
    [local.x + local.width, local.y],
    [local.x, local.y + local.height],
    [local.x + local.width, local.y + local.height],
  ].map(([px, py]) => {
    const x = px * sx
    const y = py * sy
    return { x: t.x + x * cos - y * sin, y: t.y + x * sin + y * cos }
  })
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

/** Where a ray from the center of `r` toward `toward` leaves the rectangle (connector end points). */
export function rectEdgePoint(r: Rect, toward: Point): Point {
  const c = rectCenter(r)
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  if (dx === 0 && dy === 0) return c
  const tx = dx === 0 ? Infinity : r.width / 2 / Math.abs(dx)
  const ty = dy === 0 ? Infinity : r.height / 2 / Math.abs(dy)
  const t = Math.min(tx, ty, 1)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

/** Snap the vector a→b to multiples of 45° (Shift while drawing lines). */
export function snapAngle(a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const step = Math.PI / 4
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  return { x: a.x + Math.cos(angle) * len, y: a.y + Math.sin(angle) * len }
}

/** Distance from point p to segment a-b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Drop points closer than `minDistance` to the previous kept point (freehand strokes). */
export function simplifyPoints(points: number[], minDistance: number): number[] {
  if (points.length <= 4) return points.slice()
  const out = [points[0], points[1]]
  for (let i = 2; i + 1 < points.length; i += 2) {
    const lx = out[out.length - 2]
    const ly = out[out.length - 1]
    if (Math.hypot(points[i] - lx, points[i + 1] - ly) >= minDistance) out.push(points[i], points[i + 1])
  }
  const lastX = points[points.length - 2]
  const lastY = points[points.length - 1]
  if (out[out.length - 2] !== lastX || out[out.length - 1] !== lastY) out.push(lastX, lastY)
  return out
}
