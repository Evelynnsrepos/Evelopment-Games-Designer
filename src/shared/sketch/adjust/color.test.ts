import { balanceLut, curvesLut, curveTable, defaultCurves, gradientLut, histogram, hsbAdjust, keepLuma, luma, sampleGradient, toneWeight, type Balance } from './color'

const near = (a: number[], b: number[], eps = 1e-6) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(eps))
const zero: Balance = { shadows: [0, 0, 0], midtones: [0, 0, 0], highlights: [0, 0, 0] }

describe('hue / saturation / brightness', () => {
  it('turns hue, drops saturation and brightness', () => {
    near(hsbAdjust([1, 0, 0], 180, 0, 0), [0, 1, 1])
    near(hsbAdjust([1, 0, 0], 120, 0, 0), [0, 1, 0])
    near(hsbAdjust([0.2, 0.4, 0.6], 0, 0, 0), [0.2, 0.4, 0.6])
    near(hsbAdjust([1, 0, 0], 0, -1, 0), [1, 1, 1])
    near(hsbAdjust([1, 0.5, 0], 0, 0, -1), [0, 0, 0])
    near(hsbAdjust([0.5, 0.5, 0.5], 0, 1, 0), [0.5, 0.5, 0.5])
  })
})

describe('colour balance', () => {
  it('weights the tone ranges', () => {
    expect(toneWeight('shadows', 0)).toBeCloseTo(0.7)
    expect(toneWeight('shadows', 1)).toBe(0)
    expect(toneWeight('highlights', 1)).toBeCloseTo(0.7)
    expect(toneWeight('midtones', 0.5)).toBeCloseTo(0.7)
    expect(toneWeight('midtones', 0)).toBe(0)
  })
  it('makes identity tables with no shift and warms the shadows', () => {
    const [r, g, b] = balanceLut(zero)
    for (const i of [0, 64, 128, 255]) expect([r[i], g[i], b[i]]).toEqual([i, i, i])
    const warm = balanceLut({ ...zero, shadows: [0.5, 0, -0.5] })
    expect(warm[0][20]).toBeGreaterThan(20)
    expect(warm[2][20]).toBeLessThan(20)
    expect(warm[0][250]).toBe(250)
  })
  it('keeps brightness', () => {
    const c = keepLuma([0.8, 0.2, 0.2], [0.4, 0.4, 0.4])
    expect(luma(...c)).toBeCloseTo(0.4, 2)
  })
})

describe('curves', () => {
  it('is the identity by default and passes through nodes', () => {
    const t = curveTable([{ x: 0, y: 0 }, { x: 1, y: 1 }])
    expect([t[0], t[100], t[255]]).toEqual([0, 100, 255])
    const s = curveTable([{ x: 0, y: 0 }, { x: 0.25, y: 0.1 }, { x: 0.75, y: 0.9 }, { x: 1, y: 1 }])
    expect(s[Math.round(0.25 * 255)]).toBe(Math.round(0.1 * 255))
    // Monotone: never goes down between rising nodes.
    for (let i = 1; i < 256; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1])
  })
  it('applies channel then composite, and takes up to 11 nodes', () => {
    const c = defaultCurves()
    c.all = [{ x: 0, y: 1 }, { x: 1, y: 0 }]
    const [r] = curvesLut(c)
    expect([r[0], r[255]]).toEqual([255, 0])
    const many = Array.from({ length: 14 }, (_, i) => ({ x: i / 13, y: i % 2 }))
    // Only the first 11 count: past node 11 the curve stays flat.
    expect(curveTable(many)[255]).toBe(Math.round(many[10].y * 255))
  })
  it('counts a histogram over visible pixels', () => {
    const h = histogram(new Uint8ClampedArray([10, 20, 30, 255, 10, 0, 0, 0, 10, 99, 0, 1]), 'r')
    expect(h[10]).toBe(2)
  })
})

describe('gradient map', () => {
  const stops = [{ at: 0, color: '#000000' }, { at: 0.5, color: '#ff0000' }, { at: 1, color: '#ffffff' }]
  it('samples between stops and past the ends', () => {
    near(sampleGradient(stops, 0.25), [0.5, 0, 0])
    near(sampleGradient(stops, 0.75), [1, 0.5, 0.5])
    near(sampleGradient(stops, -1), [0, 0, 0])
    near(sampleGradient([...stops].reverse(), 0.5), [1, 0, 0])
  })
  it('builds a table', () => {
    const [r, g] = gradientLut(stops)
    expect([r[0], r[128], r[255], g[255]]).toEqual([0, 255, 255, 255])
  })
})
