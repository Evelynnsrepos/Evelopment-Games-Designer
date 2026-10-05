import { describe, expect, it } from 'vitest'
import { apply, buildMesh, fitAffine, initialState, magnetAngle, magnetMove, mapPoint, outerBounds, rotateAbout, scaleAlong, snapShift, squareToQuad, toWarp, transformState, type Quad } from './transform'

const close = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 4)
  expect(p.y).toBeCloseTo(y, 4)
}

describe('transform math', () => {
  const s = initialState({ x: 10, y: 20, w: 100, h: 50 })

  it('maps the source rectangle onto its own corners at first', () => {
    close(mapPoint(s, 0, 0), 10, 20)
    close(mapPoint(s, 1, 1), 110, 70)
    close(mapPoint(s, 0.5, 0.5), 60, 45)
  })

  it('maps the unit square onto any quad (perspective)', () => {
    const q: Quad = [{ x: 0, y: 0 }, { x: 100, y: 10 }, { x: 80, y: 90 }, { x: -5, y: 70 }]
    const f = squareToQuad(q)
    close(f(0, 0), 0, 0)
    close(f(1, 0), 100, 10)
    close(f(1, 1), 80, 90)
    close(f(0, 1), -5, 70)
  })

  it('a fresh warp mesh matches the quad', () => {
    const w = toWarp(transformState(s, rotateAbout({ x: 60, y: 45 }, 0.3)))
    const r = transformState(s, rotateAbout({ x: 60, y: 45 }, 0.3))
    for (const [u, v] of [[0, 0], [1, 1], [0.5, 0.25]]) {
      const a = mapPoint(w, u, v)
      const b = mapPoint(r, u, v)
      close(a, b.x, b.y)
    }
  })

  it('rotates, scales along axes, fits and bounds', () => {
    close(apply(rotateAbout({ x: 0, y: 0 }, Math.PI / 2), { x: 1, y: 0 }), 0, 1)
    close(apply(scaleAlong({ x: 10, y: 10 }, { x: 1, y: 0 }, 2, 3), { x: 11, y: 11 }), 12, 13)
    const fit = transformState(s, fitAffine({ x: 10, y: 20, w: 100, h: 50 }, 400, 400))
    const b = outerBounds(fit)
    expect(b.w).toBeCloseTo(400)
    expect(b.y).toBeCloseTo(100)
    expect(buildMesh(s, 4).pos.length).toBe(4 * 4 * 12)
  })

  it('snaps edges and centres to the canvas, and magnetics keep 45° and 15°', () => {
    const r = snapShift({ x: 10, y: 10, w: 100, h: 100 }, -7, 0, 1000, 1000, 5)
    expect(r.dx).toBe(-10)
    expect(r.gx).toEqual([0])
    expect(snapShift({ x: 10, y: 10, w: 100, h: 100 }, 0, 438, 1000, 1000, 5).dy).toBe(440)
    expect(magnetMove(10, 1)).toEqual([10, 0])
    expect(magnetMove(10, 9)[0]).toBeCloseTo(magnetMove(10, 9)[1])
    expect(magnetAngle(0.27)).toBeCloseTo(Math.PI / 12)
  })
})
