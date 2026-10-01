import { describe, expect, it } from 'vitest'
import { createEntity, type Category } from '@/core/model'
import { dropItemName, elementSuggestions, expectedPerDefeat, formatAmount, normalizeDrop, renameKey, resistanceLabel } from './drops'

describe('drop table rows (EN-4)', () => {
  it('keeps rows valid', () => {
    expect(normalizeDrop({ id: 'r', itemId: 'i', amountMin: 3.4, amountMax: 1, chancePercent: 140 })).toEqual({
      id: 'r',
      itemId: 'i',
      amountMin: 3,
      amountMax: 3,
      chancePercent: 100,
    })
    expect(normalizeDrop({ id: 'r', itemId: 'i', amountMin: -1, amountMax: 2, chancePercent: -5 })).toMatchObject({ amountMin: 0, amountMax: 2, chancePercent: 0 })
  })

  it('formats and averages amounts', () => {
    expect(formatAmount({ amountMin: 2, amountMax: 2 })).toBe('2')
    expect(formatAmount({ amountMin: 1, amountMax: 3 })).toBe('1–3')
    // Spec AC: "Ore, 2, 50%" drops 1 ore per defeat on average.
    expect(expectedPerDefeat({ amountMin: 2, amountMax: 2, chancePercent: 50 })).toBe(1)
  })

  it('names deleted items as missing instead of failing', () => {
    const ore = createEntity('item', 'Ore')
    expect(dropItemName({ id: 'r', itemId: ore.id, amountMin: 1, amountMax: 1, chancePercent: 50 }, [ore])).toBe('Ore')
    expect(dropItemName({ id: 'r', itemId: 'gone', amountMin: 1, amountMax: 1, chancePercent: 50 }, [ore])).toBe('Missing item')
  })
})

describe('resistances', () => {
  it('describes multipliers', () => {
    expect([0, 0.5, 1, 2].map(resistanceLabel)).toEqual(['Immune', 'Resists', 'Normal', 'Weak'])
  })

  it('suggests elements from the Element category and existing resistances', () => {
    const golem = { ...createEntity('enemy', 'Golem'), resistances: { Ice: 2 } }
    const element: Category = { id: 'el', name: 'Element', kind: 'dropdown', options: ['Fire', 'Water'], appliesTo: { enemy: { mode: 'all' } }, builtIn: false }
    expect(elementSuggestions([element], [golem])).toEqual(['Fire', 'Ice', 'Water'])
  })

  it('renames keys in place and refuses duplicates', () => {
    expect(Object.keys(renameKey({ Fire: 2, Ice: 1 }, 'Fire', 'Flame')!)).toEqual(['Flame', 'Ice'])
    expect(renameKey({ Fire: 2, Ice: 1 }, 'Fire', 'Ice')).toBeNull()
  })
})
