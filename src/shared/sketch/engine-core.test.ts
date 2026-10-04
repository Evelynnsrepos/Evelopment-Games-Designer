import { describe, expect, it } from 'vitest'
import { BLEND_MODES, blendColor, blendIndex, blendPixel, GLSL_BLEND } from './blend'
import { boundsOf, maxLayers, TILE, TileHistory, tilesIn } from './tiles'

const img = (w: number, h: number, v = 0) => ({ data: new Uint8ClampedArray(w * h * 4).fill(v), width: w, height: h }) as unknown as ImageData

describe('blend modes', () => {
  it('has every mode once, Normal first, and the old ids still work', () => {
    expect(BLEND_MODES.length).toBe(26)
    expect(new Set(BLEND_MODES.map((m) => m.id)).size).toBe(26)
    expect(blendIndex('source-over')).toBe(0)
    for (const old of ['multiply', 'screen', 'overlay', 'lighter', 'color-dodge', 'luminosity'] as const) expect(blendIndex(old)).toBeGreaterThan(0)
  })

  it('matches the GLSL branches, one per mode', () => {
    for (let i = 1; i < BLEND_MODES.length; i++) expect(GLSL_BLEND).toContain(`m == ${i})`)
  })

  it('computes known values', () => {
    const half: [number, number, number] = [0.5, 0.5, 0.5]
    const q: [number, number, number] = [0.25, 0.25, 0.25]
    expect(blendColor('multiply', half, half)).toEqual([0.25, 0.25, 0.25])
    expect(blendColor('screen', half, half)).toEqual([0.75, 0.75, 0.75])
    expect(blendColor('linear-burn', [0.8, 0.8, 0.8], half)[0]).toBeCloseTo(0.3)
    expect(blendColor('subtract', half, q)).toEqual([0.25, 0.25, 0.25])
    expect(blendColor('divide', q, half)).toEqual([0.5, 0.5, 0.5])
    expect(blendColor('hard-mix', [0.6, 0.2, 0.5], [0.6, 0.2, 0.5])).toEqual([1, 0, 1])
    expect(blendColor('difference', [1, 0, 0.5], [0, 1, 0.5])).toEqual([1, 1, 0])
    expect(blendColor('darker-color', [1, 1, 1], [0, 0, 1])).toEqual([0, 0, 1])
    // Luminosity keeps the backdrop's color with the source's brightness.
    const l = blendColor('luminosity', [1, 0, 0], [0.5, 0.5, 0.5])
    expect(0.3 * l[0] + 0.59 * l[1] + 0.11 * l[2]).toBeCloseTo(0.5)
  })

  it('composites with opacity like source-over', () => {
    expect(blendPixel('source-over', [0, 0, 1, 1], [1, 0, 0, 1], 0.5)).toEqual([0.5, 0, 0.5, 1])
    expect(blendPixel('multiply', [1, 1, 1, 0], [0.2, 0.4, 0.6, 1])).toEqual([0.2, 0.4, 0.6, 1])
    expect(blendPixel('screen', [0, 0, 0, 0], [0, 0, 0, 0])).toEqual([0, 0, 0, 0])
  })
})

describe('tiles and undo', () => {
  it('finds the tiles under a rectangle, clipped to the canvas', () => {
    expect(tilesIn({ x: 10, y: 10, w: 10, h: 10 }, 1000, 1000)).toEqual([{ x: 0, y: 0, w: TILE, h: TILE }])
    const edge = tilesIn({ x: 900, y: -50, w: 500, h: 100 }, 1000, 600)
    expect(edge).toEqual([{ x: 768, y: 0, w: 232, h: TILE }])
    expect(tilesIn({ x: 0, y: 0, w: 1000, h: 600 }, 1000, 600)).toHaveLength(4 * 3)
    expect(boundsOf([{ x: 5, y: 5 }, { x: 15, y: 25 }], 2)).toEqual({ x: 3, y: 3, w: 15, h: 25 })
  })

  it('keeps only changed tiles and drops the oldest steps', () => {
    const h = new TileHistory(3, Infinity)
    const r = [{ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }]
    expect(h.push('a', r, [img(2, 2), img(2, 2)], [img(2, 2), img(2, 2)])).toBe(false)
    for (let i = 1; i <= 5; i++) h.push('a', r, [img(2, 2), img(2, 2)], [img(2, 2, i), img(2, 2)])
    expect(h.steps).toBe(3)
    const s = h.undo()!
    expect(s.tiles).toHaveLength(1)
    expect(s.tiles[0].after.data[0]).toBe(5)
    expect(h.canRedo).toBe(true)
    h.push('b', [r[0]], [img(2, 2)], [img(2, 2, 9)])
    expect(h.canRedo).toBe(false)
    h.dropLayer('a')
    expect(h.steps).toBe(1)
  })

  it('drops old steps when the memory budget is full', () => {
    const h = new TileHistory(250, 2 * 16 * 2)
    const r = [{ x: 0, y: 0, w: 2, h: 2 }]
    for (let i = 1; i <= 4; i++) h.push('a', r, [img(2, 2)], [img(2, 2, i)])
    expect(h.steps).toBe(2)
  })

  it('allows fewer layers on bigger canvases', () => {
    expect(maxLayers(1920, 1080)).toBeGreaterThan(maxLayers(8192, 8192))
    expect(maxLayers(16384, 16384)).toBe(1)
  })
})
