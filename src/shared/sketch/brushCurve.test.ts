import { describe, expect, it } from 'vitest'
import { curveAt, isLinear } from './brushCurve'

describe('curveAt', () => {
  it('is a straight line without points', () => {
    expect(curveAt(undefined, 0.3)).toBeCloseTo(0.3)
    expect(isLinear([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true)
  })

  it('passes through its points and stays inside them', () => {
    const c = [{ x: 0, y: 0 }, { x: 0.5, y: 0.9 }, { x: 1, y: 1 }]
    expect(curveAt(c, 0.5)).toBeCloseTo(0.9)
    for (let x = 0; x <= 1; x += 0.05) {
      const y = curveAt(c, x)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
    // Monotone points give a monotone curve.
    let last = -1
    for (let x = 0; x <= 1; x += 0.01) {
      const y = curveAt(c, x)
      expect(y).toBeGreaterThanOrEqual(last - 1e-9)
      last = y
    }
  })

  it('holds the end values outside the points', () => {
    const c = [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.7 }]
    expect(curveAt(c, 0)).toBeCloseTo(0.1)
    expect(curveAt(c, 1)).toBeCloseTo(0.7)
  })
})
