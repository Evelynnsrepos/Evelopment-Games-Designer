import { describe, expect, it } from 'vitest'
import { PathSmoother } from './brushPath'

const line = (n: number, wobble = 0) => Array.from({ length: n }, (_, i) => ({ x: i * 4, y: (i % 2 ? 1 : -1) * wobble, pressure: 1 }))

describe('PathSmoother', () => {
  it('passes points through when off', () => {
    const s = new PathSmoother(0, 0, 0)
    const p = { x: 3, y: 4, pressure: 0.5 }
    expect(s.push(p)).toBe(p)
    expect(s.flush()).toEqual([])
  })

  it('stabilization trails behind and catches up at the end', () => {
    const s = new PathSmoother(0.5, 0, 0)
    const pts = line(30)
    const out = pts.map((p) => s.push(p))
    expect(out[29].x).toBeLessThan(pts[29].x)
    const tail = s.flush()
    expect(tail[tail.length - 1].x).toBeCloseTo(pts[29].x)
  })

  it('motion filtering removes small shakes, expression keeps some', () => {
    const shake = (f: number, e: number) => {
      const s = new PathSmoother(0, f, e)
      const ys = line(40, 2).map((p) => s.push(p).y).slice(10)
      return Math.max(...ys) - Math.min(...ys)
    }
    expect(shake(1, 0)).toBeLessThan(1)
    expect(shake(1, 0.5)).toBeGreaterThan(shake(1, 0))
    expect(shake(0, 0)).toBeCloseTo(4)
  })
})
