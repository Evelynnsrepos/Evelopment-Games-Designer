import { newId, type AssetPath, type EntityType, type Id } from '@/core/model'

/**
 * Asset Pool (v0.5): everything that still has to be made for the game
 * (art, models, sounds…), its status, and the picture once it exists.
 * Entries made from items, characters, towns or enemies keep a link by id,
 * so their names follow renames.
 */

export const ASSET_KINDS = ['2D art', 'Icon', 'Sprite', '3D model', 'Animation', 'Sound', 'Music', 'UI', 'VFX', 'Other'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export const STATUSES = [
  { id: 'needed', label: 'Needed' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
] as const
export type Status = (typeof STATUSES)[number]['id']

export interface AssetEntry {
  id: Id
  /** For linked entries the entity's name is shown instead (kept as a fallback if the entity is deleted). */
  name: string
  kind: AssetKind
  status: Status
  /** The item, character, town or enemy this asset is for. */
  sourceType: EntityType | null
  sourceId: Id | null
  notes: string
  images: AssetPath[]
  createdAt: string
}

export interface AssetPool {
  entries: AssetEntry[]
}

export const createPool = (): AssetPool => ({ entries: [] })

export function newEntry(name: string, kind: AssetKind, source?: { type: EntityType; id: Id }): AssetEntry {
  return {
    id: newId(),
    name,
    kind,
    status: 'needed',
    sourceType: source?.type ?? null,
    sourceId: source?.id ?? null,
    notes: '',
    images: [],
    createdAt: new Date().toISOString(),
  }
}

/** Ids of entities that already have an entry of this kind. */
export function trackedIds(pool: AssetPool, type: EntityType, kind: AssetKind): Set<Id> {
  return new Set(pool.entries.filter((e) => e.sourceType === type && e.kind === kind && e.sourceId).map((e) => e.sourceId!))
}

/**
 * One entry name per checklist line. Understands plain lines, bullets and
 * Markdown checkboxes ("- [ ] Sword icon"); blank lines are skipped.
 */
export function parseChecklist(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*+•]|\d+[.)])?\s*(?:\[[ xX]?\])?\s*/, '').trim())
    .filter(Boolean)
}

export function nextStatus(s: Status): Status {
  const i = STATUSES.findIndex((x) => x.id === s)
  return STATUSES[(i + 1) % STATUSES.length].id
}

export function progress(entries: AssetEntry[]): { done: number; total: number } {
  return { done: entries.filter((e) => e.status === 'done').length, total: entries.length }
}
