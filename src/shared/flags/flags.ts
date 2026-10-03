import { useCallback } from 'react'
import { newId, type Id } from '@/core/model'
import { useDocument } from '@/core/state'

/**
 * Flags and variables (v0.7): one list of game-state values (quest_done,
 * gold, reputation) shared by the Quest Designer and the Dialogue Editor.
 * Stored as one document so it syncs when working together.
 */

export interface Flag {
  id: Id
  /** Code-friendly name, e.g. met_the_king. */
  name: string
  kind: 'bool' | 'number'
  /** Starting value. */
  initial: number
  note: string
}

export interface FlagsDoc {
  flags: Flag[]
}

/** Where the list lives: the Quest Designer's documents, under a fixed id. */
export const FLAGS_DOC = { type: 'quests' as const, id: 'flags' }

/** A condition on a flag, e.g. gold >= 100 or met_the_king is true. */
export interface Condition {
  flagId: Id
  op: '==' | '!=' | '>=' | '<=' | '>' | '<'
  value: number
}

/** A change to a flag when something happens, e.g. gold += 50 or met_the_king = true. */
export interface FlagChange {
  flagId: Id
  op: 'set' | 'add'
  value: number
}

export const OPS: Condition['op'][] = ['==', '!=', '>=', '<=', '>', '<']

export function useFlags() {
  const doc = useDocument<FlagsDoc>(FLAGS_DOC.type, FLAGS_DOC.id, () => ({ flags: [] }))
  const flags = doc.data?.flags ?? []
  const add = useCallback(
    (name: string, kind: Flag['kind'] = 'bool'): Flag => {
      const flag: Flag = { id: newId(), name: toFlagName(name), kind, initial: 0, note: '' }
      doc.update((d) => ({ flags: [...(d?.flags ?? []), flag] }))
      return flag
    },
    [doc],
  )
  const update = useCallback((id: Id, patch: Partial<Flag>) => doc.update((d) => ({ flags: d.flags.map((f) => (f.id === id ? { ...f, ...patch } : f)) })), [doc])
  const remove = useCallback((id: Id) => doc.update((d) => ({ flags: d.flags.filter((f) => f.id !== id) })), [doc])
  return { flags, add, update, remove, loaded: !!doc.data }
}

/** "Met the King!" -> "met_the_king". */
export function toFlagName(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'flag'
  )
}

export function describeCondition(c: Condition, flags: Flag[]): string {
  const f = flags.find((x) => x.id === c.flagId)
  if (!f) return '(deleted flag)'
  if (f.kind === 'bool' && (c.op === '==' || c.op === '!=')) return `${c.op === '==' ? '' : 'not '}${f.name}${c.value ? '' : ' is false'}`.trim()
  return `${f.name} ${c.op} ${c.value}`
}

export function describeChange(c: FlagChange, flags: Flag[]): string {
  const f = flags.find((x) => x.id === c.flagId)
  if (!f) return '(deleted flag)'
  if (f.kind === 'bool') return `${f.name} = ${c.value ? 'true' : 'false'}`
  return c.op === 'add' ? `${f.name} ${c.value >= 0 ? '+' : '-'}= ${Math.abs(c.value)}` : `${f.name} = ${c.value}`
}

export function checkCondition(c: Condition, state: Record<Id, number>): boolean {
  const v = state[c.flagId] ?? 0
  switch (c.op) {
    case '==':
      return v === c.value
    case '!=':
      return v !== c.value
    case '>=':
      return v >= c.value
    case '<=':
      return v <= c.value
    case '>':
      return v > c.value
    case '<':
      return v < c.value
  }
}

export function applyChange(c: FlagChange, state: Record<Id, number>): Record<Id, number> {
  return { ...state, [c.flagId]: c.op === 'add' ? (state[c.flagId] ?? 0) + c.value : c.value }
}
