import { describe, expect, it } from 'vitest'
import { localToWorld } from '@/shared/canvas'
import { cutoutBounds, cutoutFromWorld, ellipseOutline, rectOutline, type MoodImageNode } from './model'

const img = (extra: Partial<MoodImageNode> = {}): MoodImageNode => ({ id: 'i', kind: 'image', layerId: 'L', src: 'a.png', x: 100, y: 100, width: 200, height: 100, ...extra })

describe('cutouts (MB-2, MB-8)', () => {
  it('stores a rectangle drawn over the image relative to its size', () => {
    const c = cutoutFromWorld(img(), rectOutline({ x: 150, y: 120, width: 100, height: 50 }), 'rect')!
    expect(c.points).toEqual([0.25, 0.2, 0.75, 0.2, 0.75, 0.7, 0.25, 0.7])
    expect(cutoutBounds(img({ cutout: c }))).toEqual({ x: 50, y: 20, width: 100, height: 50 })
  })

  it('follows the image when it is resized', () => {
    const c = cutoutFromWorld(img(), rectOutline({ x: 150, y: 120, width: 100, height: 50 }), 'rect')!
    expect(cutoutBounds(img({ cutout: c, width: 400, height: 200 }))).toEqual({ x: 100, y: 40, width: 200, height: 100 })
  })

  it('works on rotated images', () => {
    const rotated = img({ rotation: 90 })
    const corners = [
      { x: 20, y: 10 },
      { x: 60, y: 10 },
      { x: 60, y: 50 },
      { x: 20, y: 50 },
    ].map((p) => localToWorld(p, rotated))
    const b = cutoutBounds({ ...rotated, cutout: cutoutFromWorld(rotated, corners, 'polygon')! })
    expect(b.x).toBeCloseTo(20)
    expect(b.y).toBeCloseTo(10)
    expect(b.width).toBeCloseTo(40)
    expect(b.height).toBeCloseTo(40)
  })

  it('clips outlines that spill over the edge and ignores ones outside the image', () => {
    const c = cutoutFromWorld(img(), ellipseOutline({ x: 0, y: 0, width: 400, height: 400 }), 'ellipse')!
    expect(Math.max(...c.points)).toBeLessThanOrEqual(1)
    expect(Math.min(...c.points)).toBeGreaterThanOrEqual(0)
    expect(cutoutFromWorld(img(), rectOutline({ x: 500, y: 500, width: 50, height: 50 }), 'rect')).toBeNull()
  })
})
