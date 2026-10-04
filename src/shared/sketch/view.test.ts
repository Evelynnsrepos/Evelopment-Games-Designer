import { flipAbout, pinch, rotateAbout, toDocPoint, toScreen, zoomAbout, type View } from './view'

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x)
  expect(a.y).toBeCloseTo(b.y)
}

describe('view', () => {
  const views: View[] = [
    { x: 10, y: 20, scale: 2 },
    { x: -5, y: 7, scale: 0.5, rot: 0.7 },
    { x: 100, y: 50, scale: 1.5, rot: -2, flip: true },
  ]
  it('toDocPoint undoes toScreen', () => {
    for (const v of views) close(toDocPoint(v, toScreen(v, { x: 33, y: -12 })), { x: 33, y: -12 })
  })
  it('zoom, rotate and flip keep the pivot still', () => {
    const s = { x: 200, y: 120 }
    for (const v of views) {
      const doc = toDocPoint(v, s)
      close(toScreen(zoomAbout(v, 1.7, s), doc), s)
      close(toScreen(rotateAbout(v, 0.4, s), doc), s)
      close(toScreen(flipAbout(v, s), doc), s)
    }
  })
  it('flip mirrors on screen and flipping twice gives the same view', () => {
    const v: View = { x: 0, y: 0, scale: 1, rot: 0.3 }
    const s = { x: 50, y: 50 }
    const f = flipAbout(flipAbout(v, s), s)
    close(toScreen(f, { x: 10, y: 3 }), toScreen(v, { x: 10, y: 3 }))
    const once = flipAbout({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 })
    close(toScreen(once, { x: 10, y: 0 }), { x: -10, y: 0 })
  })
  it('pinch follows the fingers', () => {
    const v: View = { x: 0, y: 0, scale: 1 }
    const a0 = { x: 0, y: 0 }
    const b0 = { x: 100, y: 0 }
    const a1 = { x: 50, y: 50 }
    const b1 = { x: 50, y: 250 }
    const w = pinch(v, a0, b0, a1, b1)
    expect(w.scale).toBeCloseTo(2)
    expect(w.rot).toBeCloseTo(Math.PI / 2)
    close(toScreen(w, toDocPoint(v, { x: 50, y: 0 })), { x: 50, y: 150 })
    expect(pinch(v, a0, b0, a1, b1, false).rot).toBe(0)
  })
})
