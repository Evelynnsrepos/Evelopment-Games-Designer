import { describe, expect, it } from 'vitest'
import { BRUSHES, createSketchDoc, dabsAlong, mirrored, moveLayer, newLayer, stabilize } from './model'

const ink = BRUSHES.find((b) => b.id === 'ink')!
const fixed = () => 0

describe('sketch model', () => {
  it('spaces dabs evenly across segments', () => {
    const a = { x: 0, y: 0, pressure: 1 }
    const b = { x: 10, y: 0, pressure: 1 }
    const c = { x: 20, y: 0, pressure: 1 }
    const first = dabsAlong(ink, 10, a, b, 0, fixed) // step 0.8
    const second = dabsAlong(ink, 10, b, c, first.carry, fixed)
    const xs = [...first.dabs, ...second.dabs].map((d) => d.x)
    const gaps = xs.slice(1).map((x, i) => +(x - xs[i]).toFixed(6))
    expect(new Set(gaps)).toEqual(new Set([0.8]))
  })

  it('pen pressure shrinks the dab', () => {
    const light = dabsAlong(ink, 20, { x: 0, y: 0, pressure: 0.2 }, { x: 40, y: 0, pressure: 0.2 }, 0, fixed).dabs[0]
    const hard = dabsAlong(ink, 20, { x: 0, y: 0, pressure: 1 }, { x: 40, y: 0, pressure: 1 }, 0, fixed).dabs[0]
    expect(light.size).toBeLessThan(hard.size)
  })

  it('mirrors points through the canvas center', () => {
    expect(mirrored({ x: 10, y: 20 }, 100, 100, 'quad')).toEqual([
      { x: 10, y: 20 },
      { x: 90, y: 20 },
      { x: 10, y: 80 },
      { x: 90, y: 80 },
    ])
  })

  it('stabilizer moves part of the way', () => {
    const p = stabilize({ x: 0, y: 0, pressure: 0 }, { x: 10, y: 0, pressure: 1 }, 0.5)
    expect(p.x).toBeGreaterThan(0)
    expect(p.x).toBeLessThan(10)
  })

  it('moves layers within the stack', () => {
    const doc = { ...createSketchDoc(), layers: [newLayer('A'), newLayer('B')] }
    const moved = moveLayer(doc, doc.layers[0].id, 1)
    expect(moved.layers.map((l) => l.name)).toEqual(['B', 'A'])
    expect(moveLayer(moved, moved.layers[1].id, 1)).toBe(moved)
  })
})
