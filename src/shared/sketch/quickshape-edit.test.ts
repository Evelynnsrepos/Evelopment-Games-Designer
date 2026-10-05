import { gentle, moveNode, shapeNodes, type Shape } from './quickshape'

describe('QuickShape editing', () => {
  it('snaps nearly level lines to 15° steps and leaves others alone', () => {
    const almost: Shape = { kind: 'line', points: [{ x: 0, y: 0 }, { x: 100, y: 3 }] }
    expect(gentle(almost).points[1].y).toBeCloseTo(0)
    expect(gentle(almost).points[1].x).toBeCloseTo(Math.hypot(100, 3))
    const free: Shape = { kind: 'line', points: [{ x: 0, y: 0 }, { x: 100, y: 12 }] }
    expect(gentle(free)).toEqual(free)
  })
  it('has nodes for every shape and moves them', () => {
    const circle: Shape = { kind: 'circle', points: [{ x: 50, y: 50 }, { x: 10, y: 10 }] }
    expect(shapeNodes(circle)).toEqual([{ x: 50, y: 50 }, { x: 60, y: 50 }])
    expect(moveNode(circle, 1, { x: 50, y: 80 }).points[1]).toEqual({ x: 30, y: 30 })
    expect(moveNode(circle, 0, { x: 0, y: 0 }).points[0]).toEqual({ x: 0, y: 0 })
    const ellipse: Shape = { kind: 'ellipse', points: [{ x: 0, y: 0 }, { x: 10, y: 5 }] }
    expect(shapeNodes(ellipse)).toHaveLength(3)
    expect(moveNode(ellipse, 2, { x: 3, y: -20 }).points[1]).toEqual({ x: 10, y: 20 })
    const rect: Shape = { kind: 'rectangle', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }
    const moved = moveNode(rect, 2, { x: 15, y: 12 })
    expect(moved.kind).toBe('quad')
    expect(moved.points[2]).toEqual({ x: 15, y: 12 })
  })
})
