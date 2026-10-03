import { newId, type Id } from '@/core/model'
import type { Condition, FlagChange } from '@/shared/flags'

/** Quest Designer (v0.7): quests with giver, place, objectives, rewards and what unlocks them. */

export const QUEST_KINDS = [
  { id: 'main', label: 'Main', color: '#f5a623' },
  { id: 'side', label: 'Side', color: '#3e8ef7' },
  { id: 'daily', label: 'Daily', color: '#30a46c' },
  { id: 'event', label: 'Event', color: '#a855f7' },
] as const
export type QuestKind = (typeof QUEST_KINDS)[number]['id']

export const OBJECTIVE_KINDS = [
  { id: 'talk', label: 'Talk to', target: 'character' },
  { id: 'kill', label: 'Defeat', target: 'enemy' },
  { id: 'collect', label: 'Collect', target: 'item' },
  { id: 'reach', label: 'Go to', target: 'town' },
  { id: 'custom', label: 'Other', target: null },
] as const
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number]['id']

export interface Objective {
  id: Id
  kind: ObjectiveKind
  /** Character, enemy, item or town, depending on the kind. */
  targetId: Id | null
  amount: number
  /** Free text, e.g. "Light the three beacons". */
  text: string
  optional: boolean
}

export interface ItemReward {
  itemId: Id
  amount: number
}

export interface Quest {
  id: Id
  name: string
  kind: QuestKind
  giverId: Id | null
  locationId: Id | null
  /** Recommended level; null = any. */
  level: number | null
  summary: string
  objectives: Objective[]
  rewardItems: ItemReward[]
  rewardXp: number
  rewardGold: number
  /** Quests that must be done first. */
  requires: Id[]
  /** Flags that must be true to start it. */
  conditions: Condition[]
  /** Flags changed when it is done. */
  onComplete: FlagChange[]
  notes: string
}

export interface QuestDoc {
  quests: Quest[]
}

export const createQuestDoc = (): QuestDoc => ({ quests: [] })

export function newQuest(name = 'New quest'): Quest {
  return {
    id: newId(),
    name,
    kind: 'side',
    giverId: null,
    locationId: null,
    level: null,
    summary: '',
    objectives: [],
    rewardItems: [],
    rewardXp: 0,
    rewardGold: 0,
    requires: [],
    conditions: [],
    onComplete: [],
    notes: '',
  }
}

export const newObjective = (): Objective => ({ id: newId(), kind: 'custom', targetId: null, amount: 1, text: '', optional: false })

/** Quests that require `id` (directly), e.g. to show "unlocks". */
export const unlockedBy = (quests: Quest[], id: Id) => quests.filter((q) => q.requires.includes(id))

/** Does adding `requireId` to quest `id` make a loop (A needs B needs A)? */
export function wouldLoop(quests: Quest[], id: Id, requireId: Id): boolean {
  if (id === requireId) return true
  const byId = new Map(quests.map((q) => [q.id, q]))
  const seen = new Set<Id>()
  const stack = [requireId]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === id) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    stack.push(...(byId.get(cur)?.requires ?? []))
  }
  return false
}

/** Every quest needed before this one, in the order they can be done. */
export function questPath(quests: Quest[], id: Id): Quest[] {
  const byId = new Map(quests.map((q) => [q.id, q]))
  const out: Quest[] = []
  const seen = new Set<Id>()
  const visit = (qid: Id) => {
    if (seen.has(qid)) return
    seen.add(qid)
    const q = byId.get(qid)
    if (!q) return
    for (const r of q.requires) visit(r)
    if (qid !== id) out.push(q)
  }
  visit(id)
  return out
}

export interface RewardTotals {
  xp: number
  gold: number
  items: Map<Id, number>
}

/** Rewards of a set of quests added up (e.g. a whole chain or the whole game). */
export function totalRewards(quests: Quest[]): RewardTotals {
  const items = new Map<Id, number>()
  let xp = 0
  let gold = 0
  for (const q of quests) {
    xp += q.rewardXp
    gold += q.rewardGold
    for (const r of q.rewardItems) items.set(r.itemId, (items.get(r.itemId) ?? 0) + r.amount)
  }
  return { xp, gold, items }
}
