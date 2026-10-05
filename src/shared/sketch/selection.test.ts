import { describe, expect, it } from 'vitest'
import { alphaBounds, feather, floodMask, grow, maskEdges } from './selection'

/** A w×h RGBA image from a string grid: '#' = black line, '.' = empty, 'r' = red. */
function image(rows: string[]) {
  const w = rows[0].length
  const d = new Uint8ClampedArray(w * rows.length * 4)
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const i = (y * w + x) * 4
      if (c === '#') d.set([0, 0, 0, 255], i)
      if (c === 'r') d.set([255, 0, 0, 255], i)
    }),
  )
  return { d, w, h: rows.length }
}
const count = (m: Uint8Array) => m.reduce((n, v) => n + (v ? 1 : 0), 0)

describe('selection pixels', () => {
  const ring = image(['.....', '.###.', '.#.#.', '.###.', '....r'])

  it('flood fills only the connected area', () => {
    expect(count(floodMask(ring.d, ring.w, ring.h, 2, 2, 0.1))).toBe(1)
    expect(count(floodMask(ring.d, ring.w, ring.h, 0, 0, 0.1))).toBe(16 - 1 + 0)
    expect(count(floodMask(ring.d, ring.w, ring.h, 1, 1, 0.1))).toBe(8)
  })

  it('takes everything alike when not contiguous, and more with a higher threshold', () => {
    expect(count(floodMask(ring.d, ring.w, ring.h, 0, 0, 0.1, false))).toBe(16)
    expect(count(floodMask(ring.d, ring.w, ring.h, 1, 1, 1))).toBe(25)
    expect(count(floodMask(ring.d, ring.w, ring.h, 9, 9, 1))).toBe(0)
  })

  it('grows and feathers masks', () => {
    const m = new Uint8Array(25)
    m[12] = 255
    expect(count(grow(m, 5, 5))).toBe(5)
    const f = feather(grow(m, 5, 5, 2), 5, 5, 3)
    expect(f[12]).toBeLessThan(255)
    expect(f[0]).toBeGreaterThan(0)
  })

  it('finds edges and bounds', () => {
    const m = new Uint8Array(9)
    m[4] = 255
    // One pixel: four unit edges.
    expect(maskEdges((p) => m[p], 3, 3)).toEqual([1, 1, 2, 1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 1, 2, 2])
    m.fill(255)
    expect(maskEdges((p) => m[p], 3, 3)).toEqual([0, 0, 3, 0, 0, 3, 3, 3, 0, 0, 0, 3, 3, 0, 3, 3])
    expect(alphaBounds((p) => m[p], 3, 3)).toEqual({ x: 0, y: 0, w: 3, h: 3 })
    expect(alphaBounds(() => 0, 3, 3)).toBeNull()
  })
})
