import { describe, expect, it } from 'vitest'
import { addStroke, BREAK_MS, cropCanvas, fitSize, flipCanvas, formatDuration, HOLD_MS, mapPoint, replayPlan, resizeCanvas, rotateCanvas, shouldRecord } from './canvas'

describe('canvas changes', () => {
  it('resizes around an anchor or scales the picture', () => {
    const c = resizeCanvas(100, 50, 200, 100, 4, false)
    expect(mapPoint(c, { x: 0, y: 0 })).toEqual({ x: 50, y: 25 })
    expect(mapPoint(resizeCanvas(100, 50, 200, 100, 8, false), { x: 0, y: 0 })).toEqual({ x: 100, y: 50 })
    expect(mapPoint(resizeCanvas(100, 50, 200, 100, 0, true), { x: 100, y: 50 })).toEqual({ x: 200, y: 100 })
    expect(resizeCanvas(100, 50, 99999, 0, 0, false)).toMatchObject({ width: 8192, height: 1 })
  })

  it('crops to a rectangle inside the canvas', () => {
    expect(cropCanvas(100, 50, { x: -10, y: 10, w: 40, h: 100 })).toEqual({ width: 30, height: 40, matrix: [1, 0, 0, 1, -0, -10] })
    expect(cropCanvas(100, 50, { x: 200, y: 0, w: 10, h: 10 })).toBeNull()
  })

  it('flips and turns', () => {
    expect(mapPoint(flipCanvas(100, 50, 'x'), { x: 10, y: 5 })).toEqual({ x: 90, y: 5 })
    expect(mapPoint(flipCanvas(100, 50, 'y'), { x: 10, y: 5 })).toEqual({ x: 10, y: 45 })
    const r = rotateCanvas(100, 50, 1)
    expect([r.width, r.height]).toEqual([50, 100])
    // Top left goes to the top right corner.
    expect(mapPoint(r, { x: 0, y: 0 })).toEqual({ x: 50, y: 0 })
    expect(mapPoint(rotateCanvas(100, 50, -1), { x: 0, y: 0 })).toEqual({ x: 0, y: 100 })
  })
})

describe('drawing stats', () => {
  it('counts strokes and drawing time without long breaks', () => {
    let s = addStroke(undefined, 0, null)
    s = addStroke(s, 5_000, 0)
    s = addStroke(s, 500_000, 5_000)
    expect(s.strokes).toBe(3)
    expect(s.timeMs).toBe(1_000 + 5_000 + BREAK_MS)
    expect(formatDuration(40_000)).toBe('40 s')
    expect(formatDuration(12 * 60_000)).toBe('12 min')
    expect(formatDuration(125 * 60_000)).toBe('2 h 05 min')
  })
})

describe('time-lapse', () => {
  it('records every few strokes at an even, small size', () => {
    expect([1, 2, 3, 4, 8].map((n) => shouldRecord(n, 4))).toEqual([false, false, false, true, true])
    expect(fitSize(3840, 2160)).toEqual({ width: 720, height: 406 })
    expect(fitSize(301, 99)).toEqual({ width: 302, height: 100 })
  })

  it('plays every frame, or fits into thirty seconds', () => {
    const full = replayPlan(100, 'full')
    expect(full).toHaveLength(101)
    expect(full.at(-1)).toEqual({ index: -1, ms: HOLD_MS })
    const short = replayPlan(5000, 'short')
    const total = short.reduce((s, f) => s + f.ms, 0)
    expect(total).toBeLessThanOrEqual(30_000.001)
    expect(total).toBeGreaterThan(29_000)
    expect(short[0].index).toBe(0)
    expect(short.at(-2)!.index).toBe(4999)
    // Few frames play slower, but never longer than half a second each.
    expect(replayPlan(4, 'short')[0].ms).toBe(500)
  })
})
