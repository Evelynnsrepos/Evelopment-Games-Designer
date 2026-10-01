import { describe, expect, it } from 'vitest'
import { localToWorld, worldToLocal } from './transform'

describe('node transforms', () => {
  const t = { x: 100, y: 50, rotation: 30, scaleX: 2, scaleY: 0.5 }

  it('round-trips a point', () => {
    const w = localToWorld({ x: 12, y: -7 }, t)
    const l = worldToLocal(w, t)
    expect(l.x).toBeCloseTo(12)
    expect(l.y).toBeCloseTo(-7)
  })

  it('rotates clockwise like Konva', () => {
    const w = localToWorld({ x: 10, y: 0 }, { x: 0, y: 0, rotation: 90 })
    expect(w.x).toBeCloseTo(0)
    expect(w.y).toBeCloseTo(10)
  })
})

describe('fitWithin', () => {
  it('scales the longer side down and keeps small images', async () => {
    const { fitWithin } = await import('./imageSize')
    expect(fitWithin(1000, 500, 360)).toEqual({ width: 360, height: 180 })
    expect(fitWithin(100, 50, 360)).toEqual({ width: 100, height: 50 })
    expect(fitWithin(0, 50, 360)).toBeNull()
  })
})
