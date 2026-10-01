import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryFs, setFs } from '@/core/fs'
import { categoryAppliesTo, type Category } from '@/core/model'
import { useProjectStore } from '@/core/state'
import {
  addCategoryToItems,
  addItem,
  applyCategoryChange,
  canUndo,
  deleteItems,
  duplicateItem,
  redo,
  removeCategoryFromItems,
  setCategoryValue,
  undo,
  updateItem,
} from './actions'

const store = () => useProjectStore.getState()
const gem = (kind: Category['kind'], ids: string[]): Category => ({
  id: 'gem',
  name: 'Gem',
  kind,
  options: kind === 'dropdown' ? ['Ruby'] : [],
  appliesTo: { item: { mode: 'selected', ids } },
  builtIn: false,
})
const gemCat = () => store().categories.find((c) => c.id === 'gem')!

describe('item list actions', () => {
  beforeEach(async () => {
    // Forget the previous test's project instead of closing it on a fresh disk.
    useProjectStore.setState({ root: null, meta: null })
    setFs(new MemoryFs())
    await store().create({ name: `Items ${Math.random()}`, description: '', components: ['item-list'] })
  })

  it('adds, edits and undoes/redoes items', () => {
    const item = addItem()
    expect(store().entities.item).toHaveLength(1)
    updateItem(item.id, { name: 'Sword' })
    undo()
    expect(store().getEntity('item', item.id)?.name).toBe('New item')
    undo()
    expect(store().entities.item).toHaveLength(0)
    redo()
    redo()
    expect(store().getEntity('item', item.id)?.name).toBe('Sword')
  })

  it('groups typing in one field into one undo step', () => {
    const item = addItem()
    updateItem(item.id, { name: 'S' }, `name:${item.id}`)
    updateItem(item.id, { name: 'Sw' }, `name:${item.id}`)
    updateItem(item.id, { name: 'Swo' }, `name:${item.id}`)
    undo()
    expect(store().getEntity('item', item.id)?.name).toBe('New item')
    expect(canUndo()).toBe(true)
  })

  it('spec AC: a category applied to two selected items shows on those two only', () => {
    const [a, b, c] = [addItem(), addItem(), addItem()]
    applyCategoryChange({ categories: [...store().categories, gem('dropdown', [])] })
    addCategoryToItems('gem', [a.id, b.id])
    expect([a, b, c].map((i) => categoryAppliesTo(gemCat(), 'item', i.id))).toEqual([true, true, false])
    removeCategoryFromItems('gem', [a.id])
    expect([a, b, c].map((i) => categoryAppliesTo(gemCat(), 'item', i.id))).toEqual([false, true, false])
    undo()
    expect(categoryAppliesTo(gemCat(), 'item', a.id)).toBe(true)
  })

  it('renaming a dropdown option carries stored values along', () => {
    const item = addItem()
    const rarity = store().categories.find((c) => c.name === 'Rarity')!
    setCategoryValue(item.id, rarity.id, 'Rare')
    applyCategoryChange({
      categories: store().categories.map((c) => (c.id === rarity.id ? { ...c, options: c.options.map((o) => (o === 'Rare' ? 'Very rare' : o)) } : c)),
      renamed: { categoryId: rarity.id, renamed: { Rare: 'Very rare' } },
    })
    expect(store().getEntity('item', item.id)?.categories[rarity.id]).toBe('Very rare')
  })

  it('duplicates with values and selected categories; delete forgets ids and undo restores', () => {
    const item = addItem()
    updateItem(item.id, { name: 'Potion', stats: { Heal: 20 } })
    applyCategoryChange({ categories: [...store().categories, gem('text', [item.id])] })
    const copy = duplicateItem(item.id)!
    expect(copy.name).toBe('Potion copy')
    expect(copy.stats).toEqual({ Heal: 20 })
    expect(categoryAppliesTo(gemCat(), 'item', copy.id)).toBe(true)

    deleteItems([item.id])
    expect(store().entities.item.map((i) => i.id)).toEqual([copy.id])
    expect(gemCat().appliesTo.item).toEqual({ mode: 'selected', ids: [copy.id] })
    undo()
    expect(store().entities.item).toHaveLength(2)
    expect(categoryAppliesTo(gemCat(), 'item', item.id)).toBe(true)
  })
})
