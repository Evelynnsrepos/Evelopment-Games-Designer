import { newId, type Id } from '@/core/model'

/**
 * Gameplay Loop (v0.9): the steps a player repeats (explore → fight → loot →
 * upgrade), drawn as a circular timeline, with branches of notes hanging off
 * each step.
 */

export const NODE_KINDS = [
  { id: 'action', label: 'Action', color: '#3e8ef7' },
  { id: 'challenge', label: 'Challenge', color: '#e03131' },
  { id: 'reward', label: 'Reward', color: '#f5a623' },
  { id: 'progress', label: 'Progression', color: '#2f9e44' },
  { id: 'social', label: 'Social', color: '#c2255c' },
  { id: 'rest', label: 'Rest', color: '#9aa0a6' },
] as const
export type NodeKind = (typeof NODE_KINDS)[number]['id']

export interface LoopNode {
  id: Id
  title: string
  kind: NodeKind
  /** What the player does in this step. */
  does: string
  /** What the step gives the player (resources, knowledge, a feeling). */
  gives: string
  /** Rough time the step takes, in minutes; sizes its arc on the timeline. */
  minutes: number
  notes: string
  /** Own segment color; empty = the color of its type. */
  color?: string
  /** Resources this step gains (+) or spends (-) each time it is played (v0.10). */
  effects?: { resourceId: Id; amount: number }[]
}

/** Something the loop produces or uses up: gold, XP, energy, potions… (v0.10). */
export interface LoopResource {
  id: Id
  name: string
  start: number
  /** Gains grow by this percent every loop (e.g. better areas give more). */
  growth: number
  /** Target to reach; 0 = none. */
  goal: number
}

export interface Branch {
  id: Id
  nodeId: Id
  /** Another branch it grows out of, or null for a branch on the step itself. */
  parentId: Id | null
  title: string
  notes: string
}

export interface LoopDoc {
  nodes: LoopNode[]
  branches: Branch[]
  /** Size the arcs by time instead of evenly. */
  timed: boolean
  resources?: LoopResource[]
  /** Loops to simulate. */
  simLoops?: number
}

export const newNode = (title = 'New step', kind: NodeKind = 'action'): LoopNode => ({ id: newId(), title, kind, does: '', gives: '', minutes: 1, notes: '' })
export const newBranch = (nodeId: Id, parentId: Id | null = null): Branch => ({ id: newId(), nodeId, parentId, title: 'New branch', notes: '' })

/** A starting loop to edit, so the tool never opens empty. */
export function createLoopDoc(): LoopDoc {
  const nodes = [
    { ...newNode('Explore', 'action'), does: 'Roam the map and find points of interest', minutes: 3 },
    { ...newNode('Fight', 'challenge'), does: 'Defeat the enemies guarding them', minutes: 2 },
    { ...newNode('Loot', 'reward'), gives: 'Gold, materials and gear', minutes: 1 },
    { ...newNode('Upgrade', 'progress'), does: 'Spend loot on stronger gear', gives: 'Access to harder areas', minutes: 2 },
  ]
  return { nodes, branches: [], timed: false }
}

export const normalizeLoop = (d: Partial<LoopDoc> | undefined): LoopDoc => ({ ...d, nodes: d?.nodes ?? [], branches: d?.branches ?? [], timed: d?.timed ?? false, resources: d?.resources ?? [], simLoops: d?.simLoops ?? 20 })

export const kindColor = (k: NodeKind) => NODE_KINDS.find((x) => x.id === k)?.color ?? '#9aa0a6'
export const nodeColor = (n: LoopNode) => n.color || kindColor(n.kind)

export const totalMinutes = (d: LoopDoc) => d.nodes.reduce((n, x) => n + Math.max(0, x.minutes), 0)

/**
 * Start and end angle of each step's arc, in radians, starting at the top and
 * going clockwise. Even, or by time when `timed` (a step with no time still gets a sliver).
 */
export function arcs(d: LoopDoc): { id: Id; start: number; end: number; mid: number }[] {
  const n = d.nodes.length
  if (n === 0) return []
  const weights = d.nodes.map((x) => (d.timed ? Math.max(x.minutes, 0) : 1))
  const total = weights.reduce((a, b) => a + b, 0)
  const sliver = 0.04
  const share = weights.map((w) => (total > 0 ? w / total : 1 / n))
  // Make room for slivers so tiny steps stay clickable.
  const fixed = share.map((s) => Math.max(s, sliver))
  const sum = fixed.reduce((a, b) => a + b, 0)
  let at = -Math.PI / 2
  return d.nodes.map((x, i) => {
    const span = (fixed[i] / sum) * Math.PI * 2
    const r = { id: x.id, start: at, end: at + span, mid: at + span / 2 }
    at += span
    return r
  })
}

/** Remove a step with its branches, or a branch with everything growing out of it. */
export function removeNode(d: LoopDoc, id: Id): LoopDoc {
  return { ...d, nodes: d.nodes.filter((x) => x.id !== id), branches: d.branches.filter((b) => b.nodeId !== id) }
}
export function removeBranch(d: LoopDoc, id: Id): LoopDoc {
  const gone = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const b of d.branches) {
      if (b.parentId && gone.has(b.parentId) && !gone.has(b.id)) {
        gone.add(b.id)
        grew = true
      }
    }
  }
  return { ...d, branches: d.branches.filter((b) => !gone.has(b.id)) }
}

export function moveNode(d: LoopDoc, id: Id, by: -1 | 1): LoopDoc {
  const i = d.nodes.findIndex((x) => x.id === id)
  const j = (i + by + d.nodes.length) % d.nodes.length
  if (i < 0 || d.nodes.length < 2) return d
  const nodes = [...d.nodes]
  ;[nodes[i], nodes[j]] = [nodes[j], nodes[i]]
  return { ...d, nodes }
}

/** How deep a branch sits (1 = on the step). */
export function depth(branches: Branch[], b: Branch): number {
  let n = 1
  let p = b.parentId
  while (p && n < 20) {
    n++
    p = branches.find((x) => x.id === p)?.parentId ?? null
  }
  return n
}

export const newResource = (name = 'Gold'): LoopResource => ({ id: newId(), name, start: 0, growth: 0, goal: 0 })

export interface SimResult {
  /** Resource amounts after each loop (index 0 = start). */
  history: Record<Id, number[]>
  /** Minutes played after each loop. */
  minutes: number[]
  /** First time a resource would go below zero. */
  shortfalls: { resourceId: Id; loop: number; step: string }[]
  /** First loop at which each goal is reached. */
  goals: Record<Id, number | null>
}

/**
 * Play the loop `loops` times: each step adds or takes its resources. Gains
 * grow by the resource's growth percent per loop; spending stays the same.
 */
export function simulate(d: LoopDoc, loops = d.simLoops ?? 20): SimResult {
  const res = d.resources ?? []
  const amount: Record<Id, number> = Object.fromEntries(res.map((r) => [r.id, r.start]))
  const history: Record<Id, number[]> = Object.fromEntries(res.map((r) => [r.id, [r.start]]))
  const goals: Record<Id, number | null> = Object.fromEntries(res.map((r) => [r.id, r.goal > 0 && r.start >= r.goal ? 0 : null]))
  const shortfalls: SimResult['shortfalls'] = []
  const minutes = [0]
  const perLoop = totalMinutes(d)
  for (let loop = 1; loop <= Math.min(10000, Math.max(0, loops)); loop++) {
    for (const n of d.nodes) {
      for (const e of n.effects ?? []) {
        const r = res.find((x) => x.id === e.resourceId)
        if (!r) continue
        const delta = e.amount > 0 ? e.amount * Math.pow(1 + r.growth / 100, loop - 1) : e.amount
        amount[r.id] += delta
        if (amount[r.id] < 0 && !shortfalls.some((s) => s.resourceId === r.id)) shortfalls.push({ resourceId: r.id, loop, step: n.title })
      }
    }
    for (const r of res) {
      history[r.id].push(Math.round(amount[r.id] * 100) / 100)
      if (goals[r.id] === null && r.goal > 0 && amount[r.id] >= r.goal) goals[r.id] = loop
    }
    minutes.push(perLoop * loop)
  }
  return { history, minutes, shortfalls, goals }
}
