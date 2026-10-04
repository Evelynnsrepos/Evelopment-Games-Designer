import { newId, type Id } from '@/core/model'

/** Factions & relations (v0.10): groups of the world and how each feels about the others. */

export interface Faction {
  id: Id
  name: string
  color: string
  description: string
  goals: string
  leaderId: Id | null
  members: Id[]
  towns: Id[]
}

export interface FactionsDoc {
  items: Faction[]
  /** "from|to" → -100 (war) … 100 (allied). Missing = neutral. */
  relations: Record<string, number>
  /** Relations are the same both ways. */
  mutual: boolean
}

export const createFactionsDoc = (): FactionsDoc => ({ items: [], relations: {}, mutual: true })

const COLORS = ['#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5', '#0c8599', '#c2255c', '#5c940d']
export const newFaction = (n: number): Faction => ({ id: newId(), name: 'New faction', color: COLORS[n % COLORS.length], description: '', goals: '', leaderId: null, members: [], towns: [] })

export const LEVELS = [
  { value: 100, label: 'Allied' },
  { value: 50, label: 'Friendly' },
  { value: 0, label: 'Neutral' },
  { value: -50, label: 'Tense' },
  { value: -100, label: 'At war' },
]

export const relKey = (a: Id, b: Id) => `${a}|${b}`

export function relation(d: FactionsDoc, a: Id, b: Id): number {
  return d.relations[relKey(a, b)] ?? (d.mutual ? (d.relations[relKey(b, a)] ?? 0) : 0)
}

export function setRelation(d: FactionsDoc, a: Id, b: Id, value: number): FactionsDoc {
  const relations = { ...d.relations, [relKey(a, b)]: value }
  if (d.mutual) relations[relKey(b, a)] = value
  return { ...d, relations }
}

export const levelLabel = (v: number) => LEVELS.reduce((best, l) => (Math.abs(l.value - v) < Math.abs(best.value - v) ? l : best)).label

/** Red for war, grey for neutral, green for allies. */
export function relationColor(v: number): string {
  const t = Math.max(-1, Math.min(1, v / 100))
  return t >= 0 ? `color-mix(in srgb, #2f9e44 ${Math.round(t * 85)}%, transparent)` : `color-mix(in srgb, #e03131 ${Math.round(-t * 85)}%, transparent)`
}

/** Remove a faction and every relation that mentions it. */
export function removeFaction(d: FactionsDoc, id: Id): FactionsDoc {
  return { ...d, items: d.items.filter((f) => f.id !== id), relations: Object.fromEntries(Object.entries(d.relations).filter(([k]) => !k.split('|').includes(id))) }
}
