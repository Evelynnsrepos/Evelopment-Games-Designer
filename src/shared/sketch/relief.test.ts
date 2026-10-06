import { describe, expect, it } from 'vitest'
import { shade } from './relief'

describe('3D paint', () => {
  it('lights the top-left slope of a raised blob and darkens the bottom-right, leaving flat paint alone', () => {
    const w = 21
    const h = 21
    const rgba = new Uint8ClampedArray(w * h * 4).fill(128)
    const alpha = new Uint8ClampedArray(w * h)
    for (let y = 5; y < 16; y++) for (let x = 5; x < 16; x++) alpha[y * w + x] = 255
    shade(rgba, alpha, w, h, 1)
    const at = (x: number, y: number) => rgba[(y * w + x) * 4]
    expect(at(5, 5)).toBeGreaterThan(140) // lit edge
    expect(at(15, 15)).toBeLessThan(120) // shadow edge
    expect(at(10, 10)).toBeGreaterThan(120) // middle stays close to the colour
    const flat = new Uint8ClampedArray(16).fill(100)
    shade(flat, new Uint8ClampedArray(4).fill(255), 2, 2, 0)
    expect([...flat]).toEqual(new Array(16).fill(100))
  })
})
