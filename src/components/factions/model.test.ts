import { describe, expect, it } from 'vitest'
import { createFactionsDoc, levelLabel, newFaction, relation, removeFaction, setRelation } from './model'

describe('factions', () => {
  it('keeps relations mutual or one-way and cleans up', () => {
    const a = newFaction(0)
    const b = newFaction(1)
    let d = { ...createFactionsDoc(), items: [a, b] }
    d = setRelation(d, a.id, b.id, -100)
    expect(relation(d, b.id, a.id)).toBe(-100)
    const oneWay = setRelation({ ...d, mutual: false }, b.id, a.id, 50)
    expect(relation(oneWay, a.id, b.id)).toBe(-100)
    expect(relation(oneWay, b.id, a.id)).toBe(50)
    expect(Object.keys(removeFaction(d, a.id).relations)).toEqual([])
    expect(levelLabel(-60)).toBe('Tense')
  })
})
