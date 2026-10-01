import { describe, expect, it } from 'vitest'
import { builtInCategories, createEntity, type Item } from '@/core/model'
import { newCategory } from '@/shared/categories'
import { DEFAULT_QUERY, droppedBy, formatDrop, nextStatName, queryItems, rangeBetween, renameStat } from './query'

function setup() {
  const cats = builtInCategories()
  const rarity = cats.find((c) => c.name === 'Rarity')!
  const value = cats.find((c) => c.name === 'Value')!
  const mk = (name: string, r: string | null, v: number | null): Item => {
    const it = createEntity('item', name)
    it.categories = { [rarity.id]: r, [value.id]: v }
    return it
  }
  const items = [mk('Sword', 'Rare', 50), mk('apple', 'Common', 1), mk('Crown', 'Legendary', 900), mk('Rock', null, null)]
  return { cats, rarity, value, items }
}

describe('queryItems (IT-8)', () => {
  it('sorts by name case-insensitively, both directions', () => {
    const { cats, items } = setup()
    expect(queryItems(items, cats, DEFAULT_QUERY).map((i) => i.name)).toEqual(['apple', 'Crown', 'Rock', 'Sword'])
    expect(queryItems(items, cats, { ...DEFAULT_QUERY, desc: true }).map((i) => i.name)).toEqual(['Sword', 'Rock', 'Crown', 'apple'])
  })

  it('sorts by dropdown option order and by number, empties last either way', () => {
    const { cats, rarity, value, items } = setup()
    const byRarity = queryItems(items, cats, { ...DEFAULT_QUERY, sort: `cat:${rarity.id}` }).map((i) => i.name)
    expect(byRarity).toEqual(['apple', 'Sword', 'Crown', 'Rock'])
    const byValueDesc = queryItems(items, cats, { ...DEFAULT_QUERY, sort: `cat:${value.id}`, desc: true }).map((i) => i.name)
    expect(byValueDesc).toEqual(['Crown', 'Sword', 'apple', 'Rock'])
  })

  it('searches name, description and category values with every word', () => {
    const { cats, items } = setup()
    items[0].description = 'A sharp blade'
    expect(queryItems(items, cats, { ...DEFAULT_QUERY, search: 'blade' }).map((i) => i.name)).toEqual(['Sword'])
    expect(queryItems(items, cats, { ...DEFAULT_QUERY, search: 'legendary' }).map((i) => i.name)).toEqual(['Crown'])
    expect(queryItems(items, cats, { ...DEFAULT_QUERY, search: 'sword common' })).toEqual([])
  })

  it('filters by a category value', () => {
    const { cats, rarity, items } = setup()
    const res = queryItems(items, cats, { ...DEFAULT_QUERY, filter: { categoryId: rarity.id, value: 'Rare' } })
    expect(res.map((i) => i.name)).toEqual(['Sword'])
  })

  it('filters only items a "selected" category is shown on', () => {
    const { cats, items } = setup()
    const el = newCategory('Gem', 'dropdown', ['Ruby'], 'item', { mode: 'selected', ids: [items[0].id] })
    expect(queryItems(items, [...cats, el], { ...DEFAULT_QUERY, filter: { categoryId: el.id, value: null } })).toEqual([])
    items[0].categories[el.id] = 'Ruby'
    const res = queryItems(items, [...cats, el], { ...DEFAULT_QUERY, filter: { categoryId: el.id, value: 'Ruby' } })
    expect(res.map((i) => i.name)).toEqual(['Sword'])
  })
})

describe('dropped by (IT-9)', () => {
  it('spec AC: Cave Golem dropping Ore 2 at 50% appears in the Ore list', () => {
    const ore = createEntity('item', 'Ore')
    const golem = createEntity('enemy', 'Cave Golem')
    golem.dropTable = [{ id: 'r1', itemId: ore.id, amountMin: 2, amountMax: 2, chancePercent: 50 }]
    const bat = createEntity('enemy', 'Bat')
    const drops = droppedBy(ore.id, [bat, golem])
    expect(drops.map((d) => d.enemyName)).toEqual(['Cave Golem'])
    expect(formatDrop(drops[0])).toBe('2 × 50%')
    expect(formatDrop({ ...drops[0], amountMax: 4 })).toBe('2–4 × 50%')
  })
})

describe('helpers', () => {
  it('selects ranges in display order', () => {
    expect(rangeBetween(['a', 'b', 'c', 'd'], 'c', 'a')).toEqual(['a', 'b', 'c'])
    expect(rangeBetween(['a', 'b'], 'x', 'b')).toEqual(['b'])
  })

  it('renames stats keeping order and refusing clashes', () => {
    const stats = { ATK: 1, DEF: 2, Cost: 3 }
    expect(Object.keys(renameStat(stats, 'DEF', 'Armor')!)).toEqual(['ATK', 'Armor', 'Cost'])
    expect(renameStat(stats, 'DEF', 'ATK')).toBeNull()
    expect(renameStat(stats, 'DEF', ' ')).toBeNull()
    expect(renameStat(stats, 'DEF', 'DEF')).toBe(stats)
    expect(nextStatName({ Stat: 1, 'Stat 2': 2 })).toBe('Stat 3')
  })
})
