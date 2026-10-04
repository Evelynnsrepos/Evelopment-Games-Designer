import { newId, type Id } from '@/core/model'

/** Crafting & recipes (v0.10): what goes in, what comes out, and the full tree down to raw materials. */

export interface Ingredient {
  /** An item from the Item List, or null for a free name. */
  itemId: Id | null
  name: string
  amount: number
}

export interface Recipe {
  id: Id
  name: string
  station: string
  seconds: number
  inputs: Ingredient[]
  outputs: Ingredient[]
  notes: string
}

export interface CraftingDoc {
  items: Recipe[]
}

export const createCraftingDoc = (): CraftingDoc => ({ items: [] })
export const newIngredient = (): Ingredient => ({ itemId: null, name: '', amount: 1 })
export const newRecipe = (): Recipe => ({ id: newId(), name: 'New recipe', station: '', seconds: 0, inputs: [newIngredient()], outputs: [newIngredient()], notes: '' })

/** Same thing across recipes: the item, or the name ignoring case. */
export const keyOf = (i: Ingredient) => (i.itemId ? `item:${i.itemId}` : `name:${i.name.trim().toLowerCase()}`)

/** The first recipe that makes this ingredient. */
export const recipeFor = (recipes: Recipe[], key: string) => recipes.find((r) => r.outputs.some((o) => keyOf(o) === key && o.amount > 0))

export interface Breakdown {
  /** Base materials no recipe makes, with total amounts. */
  raw: Map<string, { label: string; amount: number }>
  /** Every recipe used and how many times. */
  crafts: Map<Id, number>
  seconds: number
  /** Ingredients that need themselves (a loop in the recipes). */
  loops: string[]
}

/** Everything needed to make `amount` of an ingredient, all the way down. */
export function breakdown(recipes: Recipe[], key: string, amount: number, label: (i: Ingredient) => string): Breakdown {
  const out: Breakdown = { raw: new Map(), crafts: new Map(), seconds: 0, loops: [] }
  const walk = (k: string, need: number, ing: Ingredient, path: Set<string>) => {
    const r = recipeFor(recipes, k)
    if (!r || path.has(k)) {
      if (r) out.loops.push(label(ing))
      const prev = out.raw.get(k)
      out.raw.set(k, { label: label(ing), amount: (prev?.amount ?? 0) + need })
      return
    }
    const made = r.outputs.find((o) => keyOf(o) === k)!.amount
    const times = Math.ceil(need / made)
    out.crafts.set(r.id, (out.crafts.get(r.id) ?? 0) + times)
    out.seconds += times * r.seconds
    const next = new Set(path).add(k)
    for (const i of r.inputs) if (i.amount > 0 && (i.itemId || i.name.trim())) walk(keyOf(i), i.amount * times, i, next)
  }
  const start = recipes.flatMap((r) => r.outputs).find((o) => keyOf(o) === key) ?? { itemId: null, name: key, amount: 1 }
  walk(key, amount, start, new Set())
  return out
}

/** Nodes and edges of the crafting tree below an ingredient, for the graph. */
export function tree(recipes: Recipe[], key: string, label: (i: Ingredient) => string) {
  const nodes = new Map<string, { id: string; label: string; sub: string; muted: boolean }>()
  const edges: { from: string; to: string; label?: string }[] = []
  const visit = (k: string, ing: Ingredient, path: Set<string>) => {
    const r = recipeFor(recipes, k)
    nodes.set(k, { id: k, label: label(ing), sub: r ? `${r.station || 'craft'}${r.seconds ? ` · ${r.seconds}s` : ''}` : 'raw material', muted: !r })
    if (!r || path.has(k)) return
    const next = new Set(path).add(k)
    for (const i of r.inputs) {
      if (!(i.itemId || i.name.trim())) continue
      const ik = keyOf(i)
      edges.push({ from: ik, to: k, label: `×${i.amount}` })
      if (!nodes.has(ik)) visit(ik, i, next)
    }
  }
  const start = recipes.flatMap((r) => r.outputs).find((o) => keyOf(o) === key)
  if (start) visit(key, start, new Set())
  return { nodes: [...nodes.values()], edges }
}
