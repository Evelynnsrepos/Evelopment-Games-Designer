/**
 * Response curves for brushes (pressure, tilt, speed): points 0..1 on both
 * axes, drawn as a smooth line that never overshoots (monotone cubic).
 */

export interface CurvePoint {
  x: number
  y: number
}

export const LINEAR: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

/** True for a missing or straight 0→1 curve, so callers can skip the work. */
export const isLinear = (c: CurvePoint[] | undefined) => !c || c.length < 2 || (c.length === 2 && c[0].x === 0 && c[0].y === 0 && c[1].x === 1 && c[1].y === 1)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The curve's value at `x` (0..1). Points are sorted by x; no points = straight line. */
export function curveAt(points: CurvePoint[] | undefined, x: number): number {
  x = clamp01(x)
  if (isLinear(points)) return x
  const p = [...points!].sort((a, b) => a.x - b.x)
  if (x <= p[0].x) return clamp01(p[0].y)
  const n = p.length
  if (x >= p[n - 1].x) return clamp01(p[n - 1].y)
  // Fritsch-Carlson slopes keep the curve between its points.
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1].y - p[i].y) / Math.max(1e-6, p[i + 1].x - p[i].x))
  const m = p.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) m[i] = m[i + 1] = 0
    else {
      const a = m[i] / d[i]
      const b = m[i + 1] / d[i]
      const s = a * a + b * b
      if (s > 9) {
        const t = 3 / Math.sqrt(s)
        m[i] = t * a * d[i]
        m[i + 1] = t * b * d[i]
      }
    }
  }
  let i = 0
  while (x > p[i + 1].x) i++
  const h = p[i + 1].x - p[i].x
  const t = (x - p[i].x) / h
  const t2 = t * t
  const t3 = t2 * t
  return clamp01((2 * t3 - 3 * t2 + 1) * p[i].y + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * p[i + 1].y + (t3 - t2) * h * m[i + 1])
}
