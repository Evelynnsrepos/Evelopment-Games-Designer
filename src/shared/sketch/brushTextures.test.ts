import { describe, expect, it } from 'vitest'
import { GRAINS, grainValues, makeTileable, maskFromPixels } from './brushTextures'

describe('brush textures', () => {
  it('builds every grain in 0..1 and seamless', () => {
    for (const { id } of GRAINS) {
      if (id === 'none') continue
      const n = 64
      const v = grainValues(id, n)
      expect(v.every((x) => x >= 0 && x <= 1)).toBe(true)
      // Not flat.
      expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(0.1)
    }
    // The left and right edges meet: their difference is like any neighbouring columns.
    const n = 128
    const v = grainValues('clouds', n)
    let seam = 0
    let inner = 0
    for (let y = 0; y < n; y++) {
      seam += Math.abs(v[y * n] - v[y * n + n - 1])
      inner += Math.abs(v[y * n + 40] - v[y * n + 41])
    }
    expect(seam).toBeLessThan(inner * 3 + 1)
  })

  it('reads masks from brightness or from alpha', () => {
    const opaque = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255])
    expect([...maskFromPixels(opaque)]).toEqual([255, 0])
    expect([...maskFromPixels(opaque, true)]).toEqual([0, 255])
    const clear = new Uint8ClampedArray([0, 0, 0, 200, 0, 0, 0, 0])
    expect([...maskFromPixels(clear)]).toEqual([200, 0])
  })

  it('makes an image tile', () => {
    const w = 32
    const src = new Uint8ClampedArray(w * w).map((_, i) => ((i % w) * 255) / (w - 1))
    const t = makeTileable(src, w, w)
    for (let y = 0; y < w; y++) expect(Math.abs(t[y * w] - t[y * w + w - 1])).toBeLessThan(20)
  })
})
