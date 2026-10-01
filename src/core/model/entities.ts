import type { Id } from './ids'

/**
 * Entities (spec 3.3): records that live once per project in
 * `entities/<collection>.json` and are referenced by ID from anywhere.
 */
export type EntityType = 'item' | 'character' | 'town' | 'enemy'

export const ENTITY_TYPES: readonly EntityType[] = ['item', 'character', 'town', 'enemy']

/** File name (without .json) under `entities/` for each entity type. */
export const ENTITY_COLLECTION: Record<EntityType, string> = {
  item: 'items',
  character: 'characters',
  town: 'towns',
  enemy: 'enemies',
}

/** Value stored for a category on an entity; shape depends on Category.kind. */
export type CategoryValue = string | number | boolean | null

/** A path relative to the project folder, e.g. `assets/images/<id>.png`. */
export type AssetPath = string

export interface EntityBase {
  id: Id
  name: string
  description: string
  notes: string
  /** null = show the pink/black checkerboard placeholder (IT-2). */
  image: AssetPath | null
  /** Keyed by Category id. */
  categories: Record<Id, CategoryValue>
  createdAt: string
  updatedAt: string
}

/** Named numbers that calculators can read (IT-9, EN-3). */
export type StatBlock = Record<string, number>

export interface Item extends EntityBase {
  type: 'item'
  stats: StatBlock
}

/** A link from one entity to another, e.g. "Mother of" -> Aria (CH-5). */
export interface EntityLink {
  id: Id
  label: string
  targetType: EntityType
  targetId: Id
}

export interface Character extends EntityBase {
  type: 'character'
  links: EntityLink[]
}

export interface Town extends EntityBase {
  type: 'town'
  links: EntityLink[]
}

export interface DropRow {
  id: Id
  itemId: Id
  amountMin: number
  amountMax: number
  /** 0..100 */
  chancePercent: number
}

/** Stat growth per level, shared with the Level Calculator (LV-3, EN-3). */
export interface StatGrowth {
  stat: string
  mode: 'flat' | 'percent'
  perLevel: number
}

export interface Enemy extends EntityBase {
  type: 'enemy'
  levelMin: number
  levelMax: number
  stats: StatBlock
  growth: StatGrowth[]
  /** Element or type name -> damage multiplier (1 = neutral). */
  resistances: Record<string, number>
  dropTable: DropRow[]
  timeToDefeatSeconds: number | null
  respawnNote: string
  /** Town ids where the enemy appears (EN-6). */
  foundIn: Id[]
}

export type Entity = Item | Character | Town | Enemy

export type EntityOf<T extends EntityType> = Extract<Entity, { type: T }>

/** Custom categories / associations, shared by every entity type (3.4). */
export type CategoryKind = 'dropdown' | 'text' | 'number' | 'boolean'

export type CategoryScope = { mode: 'all' } | { mode: 'selected'; ids: Id[] } | { mode: 'none' }

export interface Category {
  id: Id
  name: string
  kind: CategoryKind
  /** Only used when kind === 'dropdown'. */
  options: string[]
  /** Which entities show this category, per entity type (IT-5). */
  appliesTo: Partial<Record<EntityType, CategoryScope>>
  builtIn: boolean
}
