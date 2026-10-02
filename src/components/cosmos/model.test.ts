import { describe, expect, it } from 'vitest'
import { addBody, childrenOf, createCosmos, moveBody, orbitLayout, pathTo, removeBody, subtreeIds, updateBody } from './model'

function sample() {
  let c = createCosmos()
  const galaxy = addBody(c, null)
  c = galaxy.cosmos
  const system = addBody(c, galaxy.body.id)
  c = system.cosmos
  const planet = addBody(c, system.body.id)
  c = planet.cosmos
  const moon = addBody(c, planet.body.id)
  return { c: moon.cosmos, galaxy: galaxy.body, system: system.body, planet: planet.body, moon: moon.body }
}

describe('cosmos', () => {
  it('adds the natural child kind with a numbered name', () => {
    const { c, galaxy, system, planet, moon } = sample()
    expect([galaxy.kind, system.kind, planet.kind, moon.kind]).toEqual(['galaxy', 'solar-system', 'planet', 'moon'])
    expect(planet.name).toBe('Planet 1')
    expect(addBody(c, system.id).body.name).toBe('Planet 2')
    expect(addBody(c, system.id, 'star').body.kind).toBe('star')
  })

  it('shows the path from the top for the breadcrumb', () => {
    const { c, galaxy, system, planet, moon } = sample()
    expect(pathTo(c, moon.id).map((b) => b.id)).toEqual([galaxy.id, system.id, planet.id, moon.id])
    expect(pathTo(c, null)).toEqual([])
  })

  it('deletes a body with everything inside it', () => {
    const { c, galaxy, system } = sample()
    expect(subtreeIds(c, system.id).size).toBe(3)
    expect(removeBody(c, system.id).bodies.map((b) => b.id)).toEqual([galaxy.id])
  })

  it('moves bodies but never into themselves', () => {
    const { c, galaxy, system, moon } = sample()
    expect(moveBody(c, system.id, moon.id)).toBe(c)
    const moved = moveBody(c, moon.id, galaxy.id)
    expect(childrenOf(moved, galaxy.id).map((b) => b.id)).toEqual([system.id, moon.id])
    expect(childrenOf(moveBody(c, galaxy.id, null), null).length).toBe(1)
  })

  it('edits fields without touching the parent', () => {
    const { c, planet } = sample()
    const next = updateBody(c, planet.id, { name: 'Terra', color: '#00ff00' })
    expect(next.bodies.find((b) => b.id === planet.id)).toMatchObject({ name: 'Terra', color: '#00ff00', parentId: planet.parentId })
  })

  it('puts each child on its own orbit inside the view', () => {
    const o = orbitLayout(5)
    expect(new Set(o.map((p) => p.r)).size).toBe(5)
    for (const p of o) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(281)
    expect(orbitLayout(1)[0].r).toBe(175)
    expect(orbitLayout(0)).toEqual([])
  })
})
