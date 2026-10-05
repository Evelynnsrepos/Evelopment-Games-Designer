import { activeGuide, assistFor, closestDirection, defaultGuide, guideHandles, guideLines, moveHandle, normalizeGuide, symmetryCopies, symmetryMirror, type DrawingGuide } from './guides'

const W = 400
const H = 300
const guide = (patch: Partial<DrawingGuide>): DrawingGuide => ({ ...defaultGuide(W, H), ...patch })
const round = (ps: { x: number; y: number }[]) => ps.map((p) => ({ x: Math.round(p.x * 1000) / 1000 + 0, y: Math.round(p.y * 1000) / 1000 + 0 }))

describe('guides', () => {
  it('normalizes old documents', () => {
    const g = normalizeGuide(undefined, W, H)
    expect(g.kind).toBe('off')
    expect(g.vanishing).toHaveLength(3)
    expect(normalizeGuide({ kind: 'grid', segments: 99, points: 7 as never }, W, H)).toMatchObject({ kind: 'grid', segments: 16, points: 2 })
    expect(activeGuide(g)).toBe(null)
    expect(activeGuide({ ...g, kind: 'grid' })).not.toBe(null)
    expect(activeGuide({ ...g, kind: 'grid', visible: false })).toBe(null)
  })

  it('makes symmetry copies', () => {
    const c = { x: 200, y: 150 }
    const p = { x: 210, y: 140 }
    expect(round(symmetryCopies({ symmetry: 'vertical', rotational: false, segments: 6, center: c }, p))).toEqual([p, { x: 190, y: 140 }])
    expect(round(symmetryCopies({ symmetry: 'vertical', rotational: true, segments: 6, center: c }, p))).toEqual([p, { x: 190, y: 160 }])
    expect(symmetryCopies({ symmetry: 'quadrant', rotational: false, segments: 6, center: c }, p)).toHaveLength(4)
    expect(round(symmetryCopies({ symmetry: 'quadrant', rotational: true, segments: 6, center: c }, p))[1]).toEqual({ x: 210, y: 160 })
    expect(symmetryCopies({ symmetry: 'radial', rotational: true, segments: 5, center: c }, p)).toHaveLength(5)
    expect(symmetryCopies({ symmetry: 'radial', rotational: false, segments: 5, center: c }, p)).toHaveLength(10)
  })

  it('mirrors only on layers with Drawing Assist', () => {
    const g = guide({ kind: 'symmetry', assist: ['a'] })
    expect(symmetryMirror(g, 'a')?.({ x: 0, y: 0 })).toHaveLength(2)
    expect(symmetryMirror(g, 'b')).toBe(null)
    expect(symmetryMirror(guide({ kind: 'grid', assist: ['a'] }), 'a')).toBe(null)
  })

  it('draws lines for every kind', () => {
    expect(guideLines(guide({ kind: 'grid', size: 100 }), W, H)).toHaveLength(3 + 2)
    expect(guideLines(guide({ kind: 'isometric', size: 50 }), W, H).length).toBeGreaterThan(10)
    expect(guideLines(guide({ kind: 'perspective', points: 1 }), W, H).filter((l) => l.strong)).toHaveLength(1)
    expect(guideLines(guide({ kind: 'symmetry', symmetry: 'radial', segments: 8 }), W, H)).toHaveLength(8)
    expect(guideLines(guide({ kind: 'off' }), W, H)).toHaveLength(0)
  })

  it('moves handles', () => {
    const g = guide({ kind: 'perspective', points: 2 })
    expect(guideHandles(g)).toHaveLength(2)
    expect(guideHandles(moveHandle(g, 1, { x: 5, y: 6 }))[1]).toEqual({ x: 5, y: 6 })
    expect(moveHandle(guide({ kind: 'symmetry' }), 0, { x: 1, y: 2 }).center).toEqual({ x: 1, y: 2 })
  })

  it('picks the closest direction either way along a line', () => {
    expect(closestDirection([{ x: 1, y: 0 }, { x: 0, y: 1 }], { x: -5, y: 1 })).toEqual({ x: 1, y: 0 })
  })

  it('Drawing Assist keeps strokes on grid lines', () => {
    const a = assistFor(guide({ kind: 'grid', assist: ['l'] }), 'l', 5)!
    expect(a.apply({ x: 10, y: 10, pressure: 1 }, true)).toEqual({ x: 10, y: 10, pressure: 1 })
    expect(a.apply({ x: 12, y: 11, pressure: 1 }, true)).toBe(null)
    // A look-ahead does not lock the direction.
    expect(a.apply({ x: 10, y: 30, pressure: 1 }, false)!.x).toBeCloseTo(10)
    expect(a.apply({ x: 30, y: 13, pressure: 1 }, true)!.y).toBeCloseTo(10)
    expect(a.apply({ x: 60, y: 40, pressure: 0.5 }, true)).toMatchObject({ x: 60, pressure: 0.5 })
    expect(assistFor(guide({ kind: 'grid', assist: [] }), 'l', 5)).toBe(null)
  })

  it('Drawing Assist follows lines to the vanishing point', () => {
    const vp = { x: 300, y: 100 }
    const a = assistFor(guide({ kind: 'perspective', points: 1, vanishing: [vp, vp, vp], assist: ['l'] }), 'l', 5)!
    a.apply({ x: 100, y: 200, pressure: 1 }, true)
    const q = a.apply({ x: 150, y: 170, pressure: 1 }, true)!
    // On the line from the start toward the vanishing point: slope -0.5.
    expect((q.y - 200) / (q.x - 100)).toBeCloseTo(-0.5)
  })
})
