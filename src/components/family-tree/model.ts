import { newId, type Id } from '@/core/model'

/** Family tree (v0.10): characters from the Character List joined as parents, children and partners. */

export interface Bond {
  id: Id
  kind: 'parent' | 'partner'
  /** For "parent": a is the parent of b. */
  a: Id
  b: Id
  /** e.g. "adopted", "married", "divorced". */
  note: string
}

export interface FamilyDoc {
  /** Characters shown in the tree. */
  people: Id[]
  bonds: Bond[]
}

export const createFamilyDoc = (): FamilyDoc => ({ people: [], bonds: [] })
export const newBond = (kind: Bond['kind'], a: Id, b: Id): Bond => ({ id: newId(), kind, a, b, note: '' })

export const parentsOf = (d: FamilyDoc, id: Id) => d.bonds.filter((b) => b.kind === 'parent' && b.b === id).map((b) => b.a)
export const childrenOf = (d: FamilyDoc, id: Id) => d.bonds.filter((b) => b.kind === 'parent' && b.a === id).map((b) => b.b)
export const partnersOf = (d: FamilyDoc, id: Id) => d.bonds.filter((b) => b.kind === 'partner' && (b.a === id || b.b === id)).map((b) => (b.a === id ? b.b : b.a))

/** Would making `parent` a parent of `child` make someone their own ancestor? */
export function wouldLoop(d: FamilyDoc, parent: Id, child: Id): boolean {
  if (parent === child) return true
  const stack = [parent]
  const seen = new Set<Id>()
  while (stack.length) {
    const id = stack.pop()!
    if (id === child) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...parentsOf(d, id))
  }
  return false
}

export const CARD_W = 140
export const CARD_H = 56
const GAP_X = 30
const GAP_Y = 70

/**
 * Generations top to bottom (parents above children, partners on the same row),
 * each row ordered so couples sit together and children sit under their parents.
 */
export function layoutFamily(d: FamilyDoc): Map<Id, { x: number; y: number }> {
  const gen = new Map<Id, number>()
  for (const id of d.people) gen.set(id, 0)
  // Push children below their parents, and partners onto the lower of their two rows.
  for (let pass = 0; pass < d.people.length + 2; pass++) {
    let changed = false
    for (const b of d.bonds) {
      if (!gen.has(b.a) || !gen.has(b.b)) continue
      if (b.kind === 'parent' && gen.get(b.b)! < gen.get(b.a)! + 1) {
        gen.set(b.b, gen.get(b.a)! + 1)
        changed = true
      }
      if (b.kind === 'partner' && gen.get(b.a) !== gen.get(b.b)) {
        const g = Math.max(gen.get(b.a)!, gen.get(b.b)!)
        gen.set(b.a, g)
        gen.set(b.b, g)
        changed = true
      }
    }
    if (!changed) break
  }
  const rows = new Map<number, Id[]>()
  for (const id of d.people) rows.set(gen.get(id)!, [...(rows.get(gen.get(id)!) ?? []), id])
  const pos = new Map<Id, { x: number; y: number }>()
  for (const g of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(g)!
    // Under their parents first, then keep partners next to each other.
    const want = (id: Id) => {
      const ps = parentsOf(d, id).filter((p) => pos.has(p))
      return ps.length ? ps.reduce((s, p) => s + pos.get(p)!.x, 0) / ps.length : Infinity
    }
    const ordered: Id[] = []
    for (const id of [...row].sort((a, b) => want(a) - want(b))) {
      if (ordered.includes(id)) continue
      ordered.push(id)
      for (const p of partnersOf(d, id)) if (row.includes(p) && !ordered.includes(p)) ordered.push(p)
    }
    let x = 0
    for (const id of ordered) {
      const w = want(id)
      if (Number.isFinite(w)) x = Math.max(x, w)
      pos.set(id, { x, y: g * (CARD_H + GAP_Y) })
      x += CARD_W + GAP_X
    }
  }
  return pos
}
