import { describe, expect, it } from 'vitest'
import {
  fitRect,
  MAX_SCALE,
  rectEdgePoint,
  rectFromPoints,
  rectsIntersect,
  screenToWorld,
  simplifyPoints,
  snapAngle,
  transformBounds,
  unionRects,
  worldToScreen,
  zoomAt,
} from './geometry'

describe('viewport math', () => {
  it('converts between screen and world', () => {
    const v = { x: 100, y: 50, scale: 2 }
    expect(worldToScreen({ x: 10, y: 20 }, v)).toEqual({ x: 120, y: 90 })
    expect(screenToWorld({ x: 120, y: 90 }, v)).toEqual({ x: 10, y: 20 })
  })

  it('zooms around the cursor (TL-10 wheel zoom)', () => {
    const v = { x: 0, y: 0, scale: 1 }
    const cursor = { x: 300, y: 200 }
    const before = screenToWorld(cursor, v)
    const z = zoomAt(v, cursor, 2)
    expect(z.scale).toBe(2)
    expect(screenToWorld(cursor, z)).toEqual(before)
  })

  it('clamps zoom', () => {
    expect(zoomAt({ x: 0, y: 0, scale: 4 }, { x: 0, y: 0 }, 100).scale).toBe(MAX_SCALE)
  })

  it('fits a rect into the screen, centered, without zooming past 100%', () => {
    const v = fitRect({ x: 0, y: 0, width: 100, height: 100 }, { width: 800, height: 600 }, 40, 1)
    expect(v.scale).toBe(1)
    expect(worldToScreen({ x: 50, y: 50 }, v)).toEqual({ x: 400, y: 300 })
    const big = fitRect({ x: 0, y: 0, width: 2000, height: 1000 }, { width: 1040, height: 600 }, 20)
    expect(big.scale).toBeCloseTo(0.5)
  })
})

describe('rects', () => {
  it('builds a rect from any two corners', () => {
    expect(rectFromPoints({ x: 10, y: 10 }, { x: 0, y: 5 })).toEqual({ x: 0, y: 5, width: 10, height: 5 })
  })

  it('tests intersection and union', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true)
    expect(rectsIntersect(a, { x: 11, y: 0, width: 1, height: 1 })).toBe(false)
    expect(unionRects([a, { x: 20, y: -5, width: 5, height: 5 }])).toEqual({ x: 0, y: -5, width: 25, height: 15 })
    expect(unionRects([])).toBeNull()
  })

  it('computes rotated and scaled bounds like Konva', () => {
    const local = { x: 0, y: 0, width: 100, height: 50 }
    expect(transformBounds(local, { x: 10, y: 20, scaleX: 2 })).toEqual({ x: 10, y: 20, width: 200, height: 50 })
    const r = transformBounds(local, { x: 0, y: 0, rotation: 90 })
    expect(r.x).toBeCloseTo(-50)
    expect(r.y).toBeCloseTo(0)
    expect(r.width).toBeCloseTo(50)
    expect(r.height).toBeCloseTo(100)
  })

  it('finds where a connector leaves a box', () => {
    const box = { x: 0, y: 0, width: 100, height: 50 }
    expect(rectEdgePoint(box, { x: 300, y: 25 })).toEqual({ x: 100, y: 25 })
    expect(rectEdgePoint(box, { x: 50, y: -100 })).toEqual({ x: 50, y: 0 })
  })
})

describe('drawing helpers', () => {
  it('snaps lines to 45 degrees', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 10, y: 1 })
    expect(p.y).toBeCloseTo(0)
    expect(p.x).toBeCloseTo(Math.hypot(10, 1))
  })

  it('simplifies freehand strokes but keeps the ends', () => {
    expect(simplifyPoints([0, 0, 0.5, 0, 1, 0, 5, 0, 5.2, 0], 2)).toEqual([0, 0, 5, 0, 5.2, 0])
  })
})
