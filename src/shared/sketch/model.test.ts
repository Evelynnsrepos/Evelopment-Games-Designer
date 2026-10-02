import { describe, expect, it } from 'vitest'
import { builtInBrush, defaultLibrary, seeded } from './brushes'
import { createSketchDoc, mirrored, moveLayer, newLayer, stabilize } from './model'

describe('sketch model', () => {
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

describe('brushes', () => {
  it('has unique brush ids, every set brush exists, and built-ins can be reset', () => {
    const lib = defaultLibrary()
    const ids = lib.brushes.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of lib.sets) for (const id of s.brushIds) expect(ids).toContain(id)
    expect(builtInBrush('studio-pen')?.name).toBe('Studio Pen')
  })

  it('seeded random numbers repeat, so a redrawn stroke looks the same', () => {
    const a = seeded(42)
    const b = seeded(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})
