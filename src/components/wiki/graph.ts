import type { Id } from '@/core/model'

/** Force-directed layout for the connection map (WK-5). Pure and deterministic, so the map does not jump around. */

export interface Point {
  x: number
  y: number
}

export function layoutGraph(ids: Id[], edges: [Id, Id][], previous?: Map<Id, Point>): Map<Id, Point> {
  const n = ids.length
  const pos = new Map<Id, Point>()
  if (n === 0) return pos

  // Start where the dots were last time; new dots go on a spiral so the start is spread out.
  ids.forEach((id, i) => {
    const old = previous?.get(id)
    if (old) pos.set(id, { ...old })
    else {
      const angle = i * 2.399963 // golden angle
      const r = 30 * Math.sqrt(i + 1)
      pos.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r })
    }
  })
  if (n === 1) {
    pos.set(ids[0], { x: 0, y: 0 })
    return pos
  }

  const pts = ids.map((id) => pos.get(id)!)
  const indexOf = new Map(ids.map((id, i) => [id, i]))
  const links = edges
    .map(([a, b]) => [indexOf.get(a), indexOf.get(b)] as const)
    .filter((e): e is readonly [number, number] => e[0] !== undefined && e[1] !== undefined)

  const ideal = 90
  const iterations = n > 400 ? 40 : n > 150 ? 120 : 300
  const fx = new Float64Array(n)
  const fy = new Float64Array(n)
  for (let it = 0; it < iterations; it++) {
    const cooling = 1 - it / iterations
    fx.fill(0)
    fy.fill(0)
    // Every pair pushes apart.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pts[i].x - pts[j].x
        let dy = pts[i].y - pts[j].y
        let d2 = dx * dx + dy * dy
        if (d2 < 0.01) {
          dx = (i - j) * 0.1
          dy = 0.1
          d2 = dx * dx + dy * dy
        }
        const f = (ideal * ideal) / d2
        fx[i] += dx * f
        fy[i] += dy * f
        fx[j] -= dx * f
        fy[j] -= dy * f
      }
    }
    // Lines pull together.
    for (const [a, b] of links) {
      const dx = pts[b].x - pts[a].x
      const dy = pts[b].y - pts[a].y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = d / ideal
      fx[a] += dx * f
      fy[a] += dy * f
      fx[b] -= dx * f
      fy[b] -= dy * f
    }
    // A gentle pull to the middle keeps separate groups on screen.
    const maxStep = 12 * cooling + 0.5
    for (let i = 0; i < n; i++) {
      fx[i] -= pts[i].x * 0.05
      fy[i] -= pts[i].y * 0.05
      const len = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i])
      if (len > 0) {
        const step = Math.min(len, maxStep)
        pts[i].x += (fx[i] / len) * step
        pts[i].y += (fy[i] / len) * step
      }
    }
  }
  return pos
}

export function bounds(points: Iterable<Point>, pad = 60) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (minX === Infinity) return { x: -200, y: -150, w: 400, h: 300 }
  return { x: minX - pad, y: minY - pad, w: Math.max(maxX - minX + pad * 2, 200), h: Math.max(maxY - minY + pad * 2, 150) }
}
