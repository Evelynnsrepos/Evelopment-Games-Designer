import { fieldAt, LiquifyField, type LiquifyDab } from './liquify'

const dab = (patch: Partial<LiquifyDab>): LiquifyDab => ({ mode: 'push', x: 50, y: 50, dx: 0, dy: 0, radius: 20, strength: 1, distortion: 0, seed: 1, ...patch })

describe('liquify field', () => {
  it('samples between nodes', () => {
    const f = new Float32Array([0, 0, 2, 4, 0, 0, 2, 4])
    const out = [0, 0]
    fieldAt(f, 2, 2, 0.5, 0.5, out)
    expect(out).toEqual([1, 2])
    fieldAt(f, 2, 2, 9, -3, out)
    expect(out).toEqual([2, 4])
  })

  it('push moves content with the pen and leaves far pixels alone', () => {
    const f = new LiquifyField(100, 100, 1)
    f.apply(dab({ dx: 5, dy: 0 }))
    // At the centre the colour now comes from 5 px to the left.
    expect(f.at(50, 50)[0]).toBeCloseTo(-5)
    expect(f.at(90, 90)).toEqual([0, 0])
    expect(f.at(50, 69)[0]).toBeGreaterThan(-1)
  })

  it('pushes add up along a stroke', () => {
    const f = new LiquifyField(100, 100, 1)
    f.apply(dab({ x: 50, dx: 4 }))
    f.apply(dab({ x: 54, dx: 4 }))
    expect(f.at(54, 50)[0]).toBeLessThan(-6)
  })

  it('twirl keeps the centre and turns around it; pinch and expand are opposite', () => {
    const f = new LiquifyField(100, 100, 1)
    f.apply(dab({ mode: 'twirlCw' }))
    expect(f.at(50, 50)[0]).toBeCloseTo(0)
    const [dx, dy] = f.at(60, 50)
    expect(Math.abs(dy)).toBeGreaterThan(Math.abs(dx))
    const p = new LiquifyField(100, 100, 1)
    p.apply(dab({ mode: 'pinch' }))
    const e = new LiquifyField(100, 100, 1)
    e.apply(dab({ mode: 'expand' }))
    expect(p.at(60, 50)[0]).toBeGreaterThan(0)
    expect(e.at(60, 50)[0]).toBeLessThan(0)
  })

  it('reconstruct and smooth out bring it back', () => {
    const f = new LiquifyField(100, 100, 2)
    f.apply(dab({ dx: 6 }))
    const before = Math.abs(f.at(50, 50)[0])
    for (let i = 0; i < 40; i++) f.apply(dab({ mode: 'reconstruct' }))
    expect(Math.abs(f.at(50, 50)[0])).toBeLessThan(before * 0.1)
    f.apply(dab({ mode: 'crystals' }))
    expect(f.empty).toBe(false)
    f.reset()
    expect(f.empty).toBe(true)
  })

  it('sizes the grid for big canvases', () => {
    const f = new LiquifyField(4096, 2048)
    expect(f.cell).toBe(4)
    expect(f.fw).toBe(1025)
  })
})
