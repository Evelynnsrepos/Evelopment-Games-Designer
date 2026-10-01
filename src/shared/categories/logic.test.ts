import { describe, expect, it } from 'vitest'
import { builtInCategories, categoryAppliesTo, createEntity, type Category } from '@/core/model'
import {
  applyToEntity,
  availableToAdd,
  categoriesFor,
  cleanOptions,
  coerceValue,
  compareValues,
  distinctValues,
  EMPTY_FILTER,
  forgetEntity,
  formatValue,
  matchesFilter,
  newCategory,
  removeFromEntity,
  renameValues,
  setScopeMode,
  validateCategoryName,
} from './logic'

const element = () => newCategory('Element', 'dropdown', ['Fire', 'Water', 'Earth'], 'item', { mode: 'selected', ids: [] })

describe('category scopes (IT-5, IT-6)', () => {
  it('spec AC: Element applied to two selected items shows on those two only, and is offered for characters', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((n) => createEntity('item', n))
    let el = element()
    el = applyToEntity(el, 'item', a.id)
    el = applyToEntity(el, 'item', b.id)
    const cats: Category[] = [...builtInCategories(), el]

    expect(categoriesFor(cats, 'item', a.id)).toContain(el)
    expect(categoriesFor(cats, 'item', b.id)).toContain(el)
    expect(categoriesFor(cats, 'item', c.id)).not.toContain(el)

    const hero = createEntity('character', 'Hero')
    expect(availableToAdd(cats, 'character', hero.id).map((x) => x.name)).toContain('Element')
    const onHero = applyToEntity(el, 'character', hero.id)
    expect(categoryAppliesTo(onHero, 'character', hero.id)).toBe(true)
    expect(categoryAppliesTo(onHero, 'item', a.id)).toBe(true)
  })

  it('applying twice is a no-op and "all" stays all', () => {
    const el = applyToEntity(element(), 'item', 'x')
    expect(applyToEntity(el, 'item', 'x')).toBe(el)
    const all = setScopeMode(el, 'item', 'all')
    expect(applyToEntity(all, 'item', 'y')).toBe(all)
  })

  it('removing from one entity of "all" keeps it on the others', () => {
    const all = setScopeMode(element(), 'item', 'all')
    const next = removeFromEntity(all, 'item', 'b', ['a', 'b', 'c'])
    expect(next.appliesTo.item).toEqual({ mode: 'selected', ids: ['a', 'c'] })
  })

  it('switching all -> selected keeps it on everything; none -> selected starts empty', () => {
    const all = setScopeMode(element(), 'item', 'all')
    expect(setScopeMode(all, 'item', 'selected', ['a', 'b']).appliesTo.item).toEqual({ mode: 'selected', ids: ['a', 'b'] })
    const off = setScopeMode(element(), 'item', 'none')
    expect(setScopeMode(off, 'item', 'selected', ['a']).appliesTo.item).toEqual({ mode: 'selected', ids: [] })
  })

  it('forgets deleted entities', () => {
    const el = applyToEntity(element(), 'item', 'gone')
    const cats = [el, ...builtInCategories()]
    const next = forgetEntity(cats, 'item', 'gone')
    expect(next[0].appliesTo.item).toEqual({ mode: 'selected', ids: [] })
    expect(next[1]).toBe(cats[1])
    expect(forgetEntity(next, 'item', 'gone')).toBe(next)
  })
})

describe('names and options', () => {
  it('requires unique, non-empty names ignoring case', () => {
    const cats = builtInCategories()
    expect(validateCategoryName(cats, '  ')).toMatch(/name/)
    expect(validateCategoryName(cats, 'rarity')).toMatch(/already/)
    const rarity = cats.find((c) => c.name === 'Rarity')!
    expect(validateCategoryName(cats, 'Rarity', rarity.id)).toBeNull()
    expect(validateCategoryName(cats, 'Weight')).toBeNull()
  })

  it('cleans options', () => {
    expect(cleanOptions([' Fire ', '', 'fire', 'Water'])).toEqual(['Fire', 'Water'])
  })

  it('renames stored dropdown values', () => {
    const item = createEntity('item', 'Ember')
    item.categories.el = 'Fire'
    expect(renameValues(item, 'el', { Fire: 'Flame' }).categories.el).toBe('Flame')
    expect(renameValues(item, 'el', { Water: 'Ice' })).toBe(item)
  })
})

describe('values', () => {
  it('converts between kinds without throwing', () => {
    expect(coerceValue('number', '12')).toBe(12)
    expect(coerceValue('number', 'abc')).toBeNull()
    expect(coerceValue('text', 5)).toBe('5')
    expect(coerceValue('boolean', 'yes')).toBe(true)
    expect(coerceValue('dropdown', 'fire', ['Fire'])).toBe('Fire')
    expect(coerceValue('dropdown', 'Ice', ['Fire'])).toBeNull()
    expect(coerceValue('text', '')).toBeNull()
  })

  it('formats and sorts by option order, empties last', () => {
    const rarity = builtInCategories().find((c) => c.name === 'Rarity')!
    const values = ['Rare', null, 'Common', 'Legendary']
    expect([...values].sort((a, b) => compareValues(rarity, a, b))).toEqual(['Common', 'Rare', 'Legendary', null])
    expect(formatValue(rarity, 'Nope')).toBe('')
  })

  it('filters by value, any value or empty', () => {
    const el = setScopeMode(element(), 'item', 'all')
    const fire = createEntity('item', 'Ember')
    fire.categories[el.id] = 'Fire'
    const plain = createEntity('item', 'Rock')
    expect(matchesFilter([el], 'item', fire, { categoryId: el.id, value: 'Fire' })).toBe(true)
    expect(matchesFilter([el], 'item', plain, { categoryId: el.id, value: 'Fire' })).toBe(false)
    expect(matchesFilter([el], 'item', plain, { categoryId: el.id, value: null })).toBe(false)
    expect(matchesFilter([el], 'item', plain, { categoryId: el.id, value: EMPTY_FILTER })).toBe(true)
    expect(matchesFilter([el], 'item', plain, null)).toBe(true)
    expect(distinctValues(el, 'item', [fire, plain])).toEqual(['Fire', 'Water', 'Earth'])
  })
})
