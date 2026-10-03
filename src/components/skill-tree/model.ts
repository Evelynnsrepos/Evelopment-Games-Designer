import { newId, type Id } from '@/core/model'

/**
 * Skill / talent tree (roadmap idea). Skills cost points per rank, need other
 * skills first and can need a number of points spent in the tree. The plan is a
 * test build: ranks put into skills against a point budget.
 */

export interface Skill {
  id: Id
  name: string
  kind: 'active' | 'passive'
  /** Free text, e.g. "+5% crit chance per rank". */
  effect: string
  maxRank: number
  /** Points per rank. */
  cost: number
  /** Skills that need at least one rank first. */
  requires: Id[]
  /** Points that must be spent in this tree before the first rank. */
  pointsNeeded: number
  image: string | null
  notes: string
}

export interface SkillTreeDoc {
  skills: Skill[]
  /** Points at the start, plus `perLevel` for each level up to `level`. */
  budget: { start: number; perLevel: number; level: number }
  /** Ranks put in per skill in the test build. */
  plan: Record<Id, number>
}

export const SKILL_KINDS = [
  { id: 'active', label: 'Active', color: '#e8590c' },
  { id: 'passive', label: 'Passive', color: '#3e8ef7' },
] as const

export const createSkillTreeDoc = (): SkillTreeDoc => ({ skills: [], budget: { start: 0, perLevel: 1, level: 30 }, plan: {} })

export const normalizeSkillTree = (d: Partial<SkillTreeDoc> | undefined): SkillTreeDoc => {
  const base = createSkillTreeDoc()
  return { ...base, ...d, budget: { ...base.budget, ...d?.budget }, plan: { ...d?.plan } }
}

export const newSkill = (name = 'New skill'): Skill => ({
  id: newId(),
  name,
  kind: 'passive',
  effect: '',
  maxRank: 1,
  cost: 1,
  requires: [],
  pointsNeeded: 0,
  image: null,
  notes: '',
})

export const totalPoints = (d: SkillTreeDoc) => Math.max(0, d.budget.start + d.budget.perLevel * d.budget.level)

export const spent = (d: SkillTreeDoc) => d.skills.reduce((n, s) => n + (d.plan[s.id] ?? 0) * s.cost, 0)

/** Points to max out every skill. */
export const fullTreeCost = (skills: Skill[]) => skills.reduce((n, s) => n + s.maxRank * s.cost, 0)

/** Would `skill` requiring `other` make a loop? */
export function wouldLoop(skills: Skill[], skillId: Id, otherId: Id): boolean {
  const seen = new Set<Id>()
  const stack = [otherId]
  while (stack.length) {
    const id = stack.pop()!
    if (id === skillId) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(skills.find((s) => s.id === id)?.requires ?? []))
  }
  return false
}

/** Why a rank cannot be added, or null when it can. */
export function cannotAdd(d: SkillTreeDoc, id: Id): string | null {
  const s = d.skills.find((x) => x.id === id)
  if (!s) return 'Unknown skill'
  const rank = d.plan[id] ?? 0
  if (rank >= s.maxRank) return 'Already at max rank'
  const missing = s.requires.filter((r) => !(d.plan[r] > 0)).map((r) => d.skills.find((x) => x.id === r)?.name ?? '?')
  if (missing.length) return `Needs ${missing.join(', ')} first`
  if (rank === 0 && spent(d) < s.pointsNeeded) return `Needs ${s.pointsNeeded} points spent in the tree`
  if (spent(d) + s.cost > totalPoints(d)) return 'Not enough points'
  return null
}

/** Why a rank cannot be taken back, or null when it can. */
export function cannotRemove(d: SkillTreeDoc, id: Id): string | null {
  const rank = d.plan[id] ?? 0
  if (rank === 0) return 'No ranks to take back'
  const s = d.skills.find((x) => x.id === id)!
  const after = { ...d, plan: { ...d.plan, [id]: rank - 1 } }
  if (rank === 1) {
    const dependent = d.skills.find((x) => x.requires.includes(id) && d.plan[x.id] > 0)
    if (dependent) return `${dependent.name} needs it`
  }
  // Skills unlocked by points spent must still have enough spent before them.
  const left = spent(after)
  const blocked = d.skills.find((x) => x.id !== s.id && d.plan[x.id] > 0 && x.pointsNeeded > left - (d.plan[x.id] ?? 0) * x.cost)
  if (blocked) return `${blocked.name} needs ${blocked.pointsNeeded} points spent`
  return null
}
