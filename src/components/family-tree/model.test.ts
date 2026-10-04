import { describe, expect, it } from 'vitest'
import { layoutFamily, newBond, wouldLoop, type FamilyDoc } from './model'

describe('family tree', () => {
  const d: FamilyDoc = {
    people: ['kid', 'mum', 'dad', 'grandma', 'aunt'],
    bonds: [newBond('parent', 'mum', 'kid'), newBond('parent', 'dad', 'kid'), newBond('partner', 'mum', 'dad'), newBond('parent', 'grandma', 'mum'), newBond('parent', 'grandma', 'aunt')],
  }

  it('puts generations in rows with partners together', () => {
    const p = layoutFamily(d)
    expect(p.get('grandma')!.y).toBeLessThan(p.get('mum')!.y)
    expect(p.get('mum')!.y).toBe(p.get('dad')!.y)
    expect(p.get('aunt')!.y).toBe(p.get('mum')!.y)
    expect(p.get('kid')!.y).toBeGreaterThan(p.get('dad')!.y)
    const xs = [p.get('mum')!.x, p.get('dad')!.x, p.get('aunt')!.x]
    expect(new Set(xs).size).toBe(3)
  })

  it('refuses to make someone their own ancestor', () => {
    expect(wouldLoop(d, 'kid', 'grandma')).toBe(true)
    expect(wouldLoop(d, 'aunt', 'kid')).toBe(false)
  })
})
