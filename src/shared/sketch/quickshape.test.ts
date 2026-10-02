import { describe, expect, it } from 'vitest'
import { outline, recognize, resize, type Pt } from './quickshape'

const wobble = (pts: Pt[], amount = 2) => pts.map((p, i) => ({ x: p.x + Math.sin(i * 1.7) * amount, y: p.y + Math.cos(i * 2.3) * amount }))
const path = (corners: Pt[], n = 20) =>
  corners.slice(1).flatMap((b, i) => {
    const a = corners[i]
    return Array.from({ length: n }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }))
  })
const ring = (cx: number, cy: number, rx: number, ry: number, n = 60) =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: cx + Math.cos((i / n) * Math.PI * 2) * rx, y: cy + Math.sin((i / n) * Math.PI * 2) * ry }))

describe('quickshape', () => {
  it('straightens a wobbly line', () => {
    const s = recognize(wobble(path([{ x: 0, y: 0 }, { x: 200, y: 50 }])))
    expect(s?.kind).toBe('line')
  })

  it('finds rectangles, triangles, circles and ellipses', () => {
    const rect = recognize(wobble(path([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 120 }, { x: 0, y: 120 }, { x: 0, y: 2 }])))
    expect(rect?.kind).toBe('rectangle')
    const tri = recognize(wobble(path([{ x: 0, y: 100 }, { x: 60, y: 0 }, { x: 120, y: 100 }, { x: 2, y: 100 }])))
    expect(tri?.kind).toBe('triangle')
    expect(recognize(wobble(ring(100, 100, 80, 78)))?.kind).toBe('circle')
    expect(recognize(wobble(ring(100, 100, 120, 50)))?.kind).toBe('ellipse')
  })

  it('outlines close the shape and resizing scales it', () => {
    const c = recognize(ring(0, 0, 50, 50))!
    const o = outline(c)
    expect(Math.hypot(o[0].x - o[o.length - 1].x, o[0].y - o[o.length - 1].y)).toBeLessThan(1)
    const big = resize(c, { x: 50, y: 0 }, { x: 100, y: 0 })
    expect(big.points[1].x).toBeCloseTo(c.points[1].x * 2)
  })
})

describe('perfect shapes', async () => {
  const { perfect } = await import('./quickshape')
  it('snaps lines to 15 degree steps and makes squares and circles', () => {
    const l = perfect({ kind: 'line', points: [{ x: 0, y: 0 }, { x: 100, y: 3 }] })
    expect(l.points[1].y).toBeCloseTo(0)
    const sq = perfect({ kind: 'rectangle', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }] })
    expect(sq.points[1].x - sq.points[0].x).toBeCloseTo(sq.points[3].y - sq.points[0].y)
    expect(perfect({ kind: 'ellipse', points: [{ x: 0, y: 0 }, { x: 40, y: 20 }] }).kind).toBe('circle')
  })
})
