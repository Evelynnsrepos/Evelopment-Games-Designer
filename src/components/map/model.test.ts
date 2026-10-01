import { describe, expect, it } from 'vitest'
import { newId } from '@/core/model'
import { brushPositions, addCity, createMapScene, dedupePoints, ensureMapLayers, layerForTool, makeCity, makeStreet, MAP_LAYERS, townsOnMap } from './model'

describe('map scene', () => {
  it('has its layers bottom to top', () => {
    expect(createMapScene().layers.map((l) => l.id)).toEqual(['background', 'terrain', 'streets', 'cities', 'labels'])
  })

  it('adds missing layers in the right order and leaves complete scenes alone', () => {
    const full = createMapScene()
    expect(ensureMapLayers(full)).toBe(full)
    const partial = { layers: [{ id: 'cities', name: 'Cities' }], nodes: [] }
    expect(ensureMapLayers(partial).layers.map((l) => l.id)).toEqual(['background', 'terrain', 'streets', 'cities', 'labels'])
  })

  it('puts each tool on its own layer', () => {
    expect(layerForTool('stamp')).toBe(MAP_LAYERS.terrain)
    expect(layerForTool('street')).toBe(MAP_LAYERS.streets)
    expect(layerForTool('city')).toBe(MAP_LAYERS.cities)
    expect(layerForTool('text')).toBe(MAP_LAYERS.labels)
    expect(layerForTool('select')).toBeNull()
  })
})

describe('cities (MP-5)', () => {
  it('store only the town id, never its name', () => {
    const townId = newId()
    const scene = addCity(createMapScene(), makeCity(townId, { x: 10, y: 20 }))
    const [city] = scene.nodes
    expect(city).toMatchObject({ kind: 'city', townId, x: 10, y: 20, layerId: 'cities' })
    expect(JSON.stringify(city)).not.toContain('name')
    expect(townsOnMap(scene)).toEqual(new Set([townId]))
  })
})

describe('streets (MP-2)', () => {
  it('stores points relative to the first one', () => {
    const s = makeStreet(
      [
        { x: 100, y: 50 },
        { x: 130, y: 90 },
      ],
      'road',
    )
    expect(s).toMatchObject({ x: 100, y: 50, points: [0, 0, 30, 40], mode: 'road' })
  })

  it('needs two points', () => {
    expect(makeStreet([{ x: 0, y: 0 }], 'path')).toBeNull()
  })

  it('drops the repeated point of a double-click', () => {
    expect(
      dedupePoints([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 5, y: 5.1 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ])
  })
})

describe('stamp brush (MP-3)', () => {
  it('places one stamp per spacing along the stroke', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(brushPositions(line, 25)).toHaveLength(5)
  })

  it('carries the distance across short segments', () => {
    const steps = Array.from({ length: 11 }, (_, i) => ({ x: i * 10, y: 0 }))
    expect(brushPositions(steps, 25)).toHaveLength(5)
  })

  it('keeps stamps near the stroke with a small size variation', () => {
    for (const p of brushPositions([{ x: 0, y: 0 }, { x: 0, y: 200 }], 20, 7)) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(5)
      expect(p.scale).toBeGreaterThanOrEqual(0.85)
      expect(p.scale).toBeLessThanOrEqual(1.15)
    }
  })
})
