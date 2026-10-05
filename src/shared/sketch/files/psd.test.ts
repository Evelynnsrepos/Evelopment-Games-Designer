import { describe, expect, it } from 'vitest'
import { newLayer, type SketchLayer } from '../model'
import { packBits, unpackBits } from './bytes'
import { blendFromKey, blendToKey, readPsd, writePsd, type Pixels } from './psd'

const W = 6
const H = 4
const L = (id: string, extra: Partial<SketchLayer> = {}): SketchLayer => ({ ...newLayer(id), id, ...extra })

/** A canvas-size picture with one coloured box. */
function box(x0: number, y0: number, x1: number, y1: number, rgba: number[]): Pixels {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set(rgba, (y * W + x) * 4)
  return { width: W, height: H, data }
}

describe('PackBits', () => {
  it('round-trips runs and literals', () => {
    const src = Uint8Array.from([1, 1, 1, 1, 2, 3, 4, 4, 5, 5, 5, ...new Array(300).fill(9), 7])
    const packed = packBits(src)
    const out = new Uint8Array(src.length)
    unpackBits(packed, out)
    expect([...out]).toEqual([...src])
    expect(packed.length).toBeLessThan(src.length)
  })
})

describe('PSD', () => {
  it('maps every blend mode both ways', () => {
    for (const id of ['multiply', 'linear-burn', 'hard-mix', 'divide', 'luminosity'] as const) expect(blendFromKey(blendToKey(id))).toBe(id)
    expect(blendFromKey('pass')).toBe('source-over')
  })

  it('writes layers, groups, masks and settings that read back the same', () => {
    const layers = [
      L('bg'),
      L('a', { parent: 'g', blend: 'multiply', opacity: 0.5 }),
      L('b', { parent: 'g', clip: true, visible: false, name: 'Ünïcode ✓' }),
      L('g', { kind: 'group', collapsed: true }),
      L('m', { kind: 'mask' }),
      L('empty'),
    ]
    const px: Record<string, Pixels> = {
      bg: box(0, 0, W, H, [255, 255, 255, 255]),
      a: box(1, 1, 3, 3, [200, 10, 20, 255]),
      b: box(2, 0, 4, 2, [0, 0, 255, 128]),
      m: box(0, 0, 3, H, [255, 255, 255, 255]),
    }
    const bytes = writePsd({ width: W, height: H, layers, pixels: (id) => px[id] ?? null, composite: box(0, 0, W, H, [9, 8, 7, 255]) })
    const f = readPsd(bytes)
    expect([f.width, f.height]).toEqual([W, H])
    const byName = (n: string) => f.layers.find((l) => l.name === n)!
    expect(f.layers.map((l) => l.name)).toEqual(['bg', 'a', 'Ünïcode ✓', 'g', 'Mask', 'empty'])
    const g = byName('g')
    expect(g.kind).toBe('group')
    expect(g.collapsed).toBe(true)
    expect(byName('a').parent).toBe(g.id)
    expect(byName('a').blend).toBe('multiply')
    expect(byName('a').opacity).toBeCloseTo(0.5, 2)
    expect(byName('a').pixels).toMatchObject({ left: 1, top: 1, width: 2, height: 2 })
    expect([...byName('a').pixels!.data.slice(0, 4)]).toEqual([200, 10, 20, 255])
    const b = byName('Ünïcode ✓')
    expect([b.visible, b.clip]).toEqual([false, true])
    expect(b.pixels!.data[3]).toBe(128)
    const mask = byName('Mask')
    expect(mask.kind).toBe('mask')
    expect(mask.parent).toBeNull()
    // Left part white (shown), right part black (hidden).
    expect(mask.pixels!.data[0]).toBe(255)
    expect(mask.pixels!.data[5 * 4]).toBe(0)
    expect(byName('empty').pixels).toBeNull()
  })

  it('reads a flattened file without layers', () => {
    const bytes = writePsd({ width: W, height: H, layers: [], pixels: () => null, composite: box(0, 0, W, H, [9, 8, 7, 255]) })
    const f = readPsd(bytes)
    expect(f.layers).toHaveLength(1)
    expect([...f.layers[0].pixels!.data.slice(0, 4)]).toEqual([9, 8, 7, 255])
  })

  it('refuses other files with a clear message', () => {
    expect(() => readPsd(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/not a Photoshop/)
  })
})
