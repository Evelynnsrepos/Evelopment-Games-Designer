import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryFs, setFs } from '@/core/fs'
import { categoryAppliesTo, createEntity, type Category, type Enemy } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { cloneFields, createEntityActions } from './actions'
import { enemyStatsAtLevel, statAtLevel } from './growth'
import { backlinksTo } from './links'
import { requestEntityFocus, takeEntityFocus, requestWikiArticle, takeWikiArticleRequest } from './navigation'
import { DEFAULT_QUERY, queryEntities } from './query'

const store = () => useProjectStore.getState()
const characters = createEntityActions('character')

describe('entity list actions', () => {
  beforeEach(async () => {
    useProjectStore.setState({ root: null, meta: null })
    setFs(new MemoryFs())
    await store().create({ name: `Lists ${Math.random()}`, description: '', components: ['character-list'] })
  })

  it('adds, edits, groups typing and undoes/redoes', () => {
    const aria = characters.add('New character')
    characters.update(aria.id, { name: 'A' }, 'name')
    characters.update(aria.id, { name: 'Aria' }, 'name')
    expect(store().getEntity('character', aria.id)?.name).toBe('Aria')
    characters.undo() // both keystrokes are one step
    expect(store().getEntity('character', aria.id)?.name).toBe('New character')
    characters.undo()
    expect(store().entities.character).toHaveLength(0)
    characters.redo()
    characters.redo()
    expect(store().getEntity('character', aria.id)?.name).toBe('Aria')
  })

  it('duplicates with fresh link ids and the same "only selected" categories', () => {
    const town = store().addEntity('town', 'Ironhold')
    const aria = characters.add('Aria')
    characters.update(aria.id, { links: [{ id: 'l1', label: 'Lives in', targetType: 'town', targetId: town.id }] })
    const cat: Category = { id: 'c', name: 'Clan', kind: 'text', options: [], appliesTo: { character: { mode: 'selected', ids: [aria.id] } }, builtIn: false }
    store().setCategories([cat])
    const copy = characters.duplicate(aria.id)!
    expect(copy.name).toBe('Aria copy')
    expect(copy.links[0].targetId).toBe(town.id)
    expect(copy.links[0].id).not.toBe('l1')
    expect(categoryAppliesTo(store().categories[0], 'character', copy.id)).toBe(true)
  })

  it('deletes and forgets selected-scope ids, undo restores both', () => {
    const a = characters.add('A')
    store().setCategories([{ id: 'c', name: 'Clan', kind: 'text', options: [], appliesTo: { character: { mode: 'selected', ids: [a.id] } }, builtIn: false }])
    characters.remove([a.id])
    expect(store().entities.character).toHaveLength(0)
    expect(store().categories[0].appliesTo.character).toEqual({ mode: 'selected', ids: [] })
    characters.undo()
    expect(store().entities.character).toHaveLength(1)
    expect(store().categories[0].appliesTo.character).toEqual({ mode: 'selected', ids: [a.id] })
  })

  it('finds backlinks from characters and towns', () => {
    const town = store().addEntity('town', 'Ironhold')
    const aria = store().addEntity('character', 'Aria')
    store().updateEntity('character', aria.id, { links: [{ id: 'l', label: 'Lives in', targetType: 'town', targetId: town.id }] })
    const links = backlinksTo(town.id, store().entities)
    expect(links.map((b) => `${b.source.name} ${b.link.label}`)).toEqual(['Aria Lives in'])
  })
})

describe('cloneFields', () => {
  it('deep copies without id, name or dates', () => {
    const e = createEntity('enemy', 'Golem')
    e.dropTable.push({ id: 'd', itemId: 'ore', amountMin: 2, amountMax: 2, chancePercent: 50 })
    const c = cloneFields(e)
    expect('id' in c || 'name' in c || 'createdAt' in c).toBe(false)
    expect(c.dropTable[0].id).not.toBe('d')
    expect(e.dropTable[0].id).toBe('d')
  })
})

describe('queryEntities', () => {
  const enemy = (name: string, hp: number, def?: number): Enemy => ({
    ...createEntity('enemy', name),
    stats: def === undefined ? { HP: hp } : { HP: hp, DEF: def },
  })
  const list = [enemy('Slime', 20), enemy('Cave Golem', 300, 50), enemy('Bat', 15, 2)]
  const stats = (e: Enemy) => e.stats

  it('filters by a stat range (EN-7)', () => {
    const r = queryEntities(list, 'enemy', [], { ...DEFAULT_QUERY, stat: { stat: 'HP', min: 16, max: null } }, { stats })
    expect(r.map((e) => e.name)).toEqual(['Cave Golem', 'Slime'])
  })

  it('sorts by stat with missing values last in both directions', () => {
    const asc = queryEntities(list, 'enemy', [], { ...DEFAULT_QUERY, sort: 'stat:DEF' }, { stats })
    expect(asc.map((e) => e.name)).toEqual(['Bat', 'Cave Golem', 'Slime'])
    const desc = queryEntities(list, 'enemy', [], { ...DEFAULT_QUERY, sort: 'stat:DEF', desc: true }, { stats })
    expect(desc.map((e) => e.name)).toEqual(['Cave Golem', 'Bat', 'Slime'])
  })

  it('searches extra text such as drop item names', () => {
    const r = queryEntities(list, 'enemy', [], { ...DEFAULT_QUERY, search: 'ore' }, { stats, searchText: (e) => (e.name === 'Cave Golem' ? ['Ore'] : []) })
    expect(r.map((e) => e.name)).toEqual(['Cave Golem'])
  })
})

describe('growth (EN-3, LV-3)', () => {
  it('matches the Level Calculator formulas', () => {
    expect(statAtLevel(100, { mode: 'flat', perLevel: 10 }, 2)).toBe(110)
    expect(statAtLevel(100, { mode: 'percent', perLevel: 10 }, 3)).toBeCloseTo(121)
    expect(statAtLevel(100, undefined, 50)).toBe(100)
    expect(enemyStatsAtLevel({ stats: { ATK: 100, DEF: 5 }, growth: [{ stat: 'ATK', mode: 'flat', perLevel: 10 }] }, 1)).toEqual({ ATK: 100, DEF: 5 })
  })
})

describe('navigation requests', () => {
  it('hands a focus request only to the matching list, once', () => {
    requestEntityFocus('town', 't1')
    expect(takeEntityFocus('character')).toBeNull()
    expect(takeEntityFocus('town')?.id).toBe('t1')
    expect(takeEntityFocus('town')).toBeNull()
  })

  it('queues a wiki article request', () => {
    requestWikiArticle('enemy', 'e1')
    expect(takeWikiArticleRequest()).toMatchObject({ type: 'enemy', id: 'e1' })
    expect(takeWikiArticleRequest()).toBeNull()
  })
})
