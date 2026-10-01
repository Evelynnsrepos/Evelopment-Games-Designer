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
