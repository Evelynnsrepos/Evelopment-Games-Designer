import { describe, expect, it } from 'vitest'
import { breakdown, keyOf, tree, type Ingredient, type Recipe } from './model'

const ing = (name: string, amount: number): Ingredient => ({ itemId: null, name, amount })
const recipe = (name: string, outputs: Ingredient[], inputs: Ingredient[], seconds = 0): Recipe => ({ id: name, name, station: '', seconds, inputs, outputs, notes: '' })
const label = (i: Ingredient) => i.name

describe('crafting', () => {
  const recipes = [
    recipe('Sword', [ing('Sword', 1)], [ing('Iron bar', 3), ing('Wood', 1)], 10),
    recipe('Iron bar', [ing('Iron bar', 2)], [ing('Iron ore', 3), ing('Coal', 1)], 5),
  ]

  it('breaks a recipe down to raw materials, rounding crafts up', () => {
    const b = breakdown(recipes, keyOf(ing('Sword', 1)), 2, label)
    // 2 swords need 6 bars = 3 smelts = 9 ore + 3 coal, and 2 wood
    expect(Object.fromEntries([...b.raw].map(([, v]) => [v.label, v.amount]))).toEqual({ 'Iron ore': 9, Coal: 3, Wood: 2 })
    expect(b.crafts.get('Iron bar')).toBe(3)
    expect(b.seconds).toBe(2 * 10 + 3 * 5)
  })

  it('stops at loops and builds a tree', () => {
    const loop = [...recipes, recipe('Ore from bars', [ing('Iron ore', 5)], [ing('Iron bar', 1)])]
    const b = breakdown(loop, keyOf(ing('Sword', 1)), 1, label)
    expect(b.loops.length).toBeGreaterThan(0)
    const t = tree(recipes, keyOf(ing('Sword', 1)), label)
    expect(t.nodes.map((n) => n.label).sort()).toEqual(['Coal', 'Iron bar', 'Iron ore', 'Sword', 'Wood'])
    expect(t.edges).toContainEqual({ from: 'name:iron ore', to: 'name:iron bar', label: '×3' })
  })
})
