import {
  categoryAppliesTo,
  createCategory,
  type Category,
  type CategoryKind,
  type CategoryScope,
  type CategoryValue,
  type EntityBase,
  type EntityType,
  type Id,
} from '@/core/model'

/**
 * Pure helpers for shared custom categories (spec 3.4, IT-4..IT-6).
 *
 * Scope per entity type:
 * - missing or `none`: not used for this entity type
 * - `all`: shown on every entity of the type
 * - `selected`: shown only on the listed entities (may be empty: used for the type, on no entity yet)
 *
 * Deleting a category leaves its old values on entities. They are keyed by the
 * category's id, so they are invisible and harmless, and undo can bring them back.
 * Likewise values are converted when read (`readValue`), not when a kind changes.
 */

export const KIND_LABELS: Record<CategoryKind, string> = {
  dropdown: 'Dropdown',
  text: 'Text',
  number: 'Number',
  boolean: 'Yes / No',
}

export const KINDS: CategoryKind[] = ['dropdown', 'text', 'number', 'boolean']

export const ENTITY_LABELS: Record<EntityType, { one: string; many: string }> = {
  item: { one: 'item', many: 'Items' },
  character: { one: 'character', many: 'Characters' },
  town: { one: 'town', many: 'Towns' },
  enemy: { one: 'enemy', many: 'Enemies' },
}

export type ScopeMode = CategoryScope['mode']

export function scopeOf(category: Category, type: EntityType): CategoryScope {
  return category.appliesTo[type] ?? { mode: 'none' }
}

/** Is the category switched on for this entity type at all (all or selected)? */
export function isUsedFor(category: Category, type: EntityType): boolean {
  return scopeOf(category, type).mode !== 'none'
}

/** Categories shown on one entity, in project order. */
export function categoriesFor(categories: Category[], type: EntityType, entityId: Id): Category[] {
  return categories.filter((c) => categoryAppliesTo(c, type, entityId))
}

/** Categories that exist in the project but are not on this entity yet (IT-6: usable everywhere). */
export function availableToAdd(categories: Category[], type: EntityType, entityId: Id): Category[] {
  return categories.filter((c) => !categoryAppliesTo(c, type, entityId))
}

function withScope(category: Category, type: EntityType, scope: CategoryScope): Category {
  return { ...category, appliesTo: { ...category.appliesTo, [type]: scope } }
}

/** Switch a category's scope for a type. Going to `selected` keeps any ids already selected. */
export function setScopeMode(category: Category, type: EntityType, mode: ScopeMode, allIds: Id[] = []): Category {
  const current = scopeOf(category, type)
  if (current.mode === mode) return category
  if (mode === 'selected') {
    // From "all", keep it on everything so switching modes never hides values by surprise.
    const ids = current.mode === 'selected' ? current.ids : current.mode === 'all' ? [...allIds] : []
    return withScope(category, type, { mode: 'selected', ids })
  }
  return withScope(category, type, { mode })
}

/** Show the category on one more entity (IT-5). */
export function applyToEntity(category: Category, type: EntityType, entityId: Id): Category {
  const scope = scopeOf(category, type)
  if (scope.mode === 'all') return category
  const ids = scope.mode === 'selected' ? scope.ids : []
  if (ids.includes(entityId)) return category
  return withScope(category, type, { mode: 'selected', ids: [...ids, entityId] })
}

/** Hide the category on one entity. From "all" this becomes "selected" with every other entity. */
export function removeFromEntity(category: Category, type: EntityType, entityId: Id, allIds: Id[]): Category {
  const scope = scopeOf(category, type)
  if (scope.mode === 'none') return category
  const ids = scope.mode === 'all' ? allIds : scope.ids
  return withScope(category, type, { mode: 'selected', ids: ids.filter((id) => id !== entityId) })
}

/** Drop ids of deleted entities from every `selected` scope of this type. */
export function forgetEntity(categories: Category[], type: EntityType, entityId: Id): Category[] {
  let changed = false
  const next = categories.map((c) => {
    const scope = c.appliesTo[type]
    if (scope?.mode !== 'selected' || !scope.ids.includes(entityId)) return c
    changed = true
    return withScope(c, type, { mode: 'selected', ids: scope.ids.filter((id) => id !== entityId) })
  })
  return changed ? next : categories
}

/** Returns an error message, or null when the name is fine. Names are unique, ignoring case. */
export function validateCategoryName(categories: Category[], name: string, excludeId?: Id): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'A category needs a name.'
  const clash = categories.find((c) => c.id !== excludeId && c.name.trim().toLowerCase() === trimmed.toLowerCase())
  return clash ? `There is already a category called "${clash.name}".` : null
}

/** The category with this name (ignoring case and spaces), if any. */
export function findByName(categories: Category[], name: string): Category | undefined {
  const n = name.trim().toLowerCase()
  return n ? categories.find((c) => c.name.trim().toLowerCase() === n) : undefined
}

/** Clean an options list: trimmed, no blanks, no duplicates (case-insensitive). */
export function cleanOptions(options: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of options) {
    const o = raw.trim()
    if (!o || seen.has(o.toLowerCase())) continue
    seen.add(o.toLowerCase())
    out.push(o)
  }
  return out
}

/** Create a category scoped to one entity type. */
export function newCategory(
  name: string,
  kind: CategoryKind,
  options: string[],
  type: EntityType,
  scope: CategoryScope,
): Category {
  const c = createCategory(name.trim(), kind, kind === 'dropdown' ? cleanOptions(options) : [])
  return withScope(c, type, scope)
}

/** Convert a stored value to fit a category kind; null when it cannot be kept. */
export function coerceValue(kind: CategoryKind, value: CategoryValue | undefined, options: string[] = []): CategoryValue {
  if (value === undefined || value === null || value === '') return null
  switch (kind) {
    case 'text':
      return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
    case 'number': {
      if (typeof value === 'number') return value
      if (typeof value === 'boolean') return null
      const n = Number(String(value).trim())
      return Number.isFinite(n) ? n : null
    }
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase()
        if (['yes', 'true', 'y', '1'].includes(v)) return true
        if (['no', 'false', 'n', '0'].includes(v)) return false
      }
      return typeof value === 'number' ? value !== 0 : null
    case 'dropdown': {
      const s = String(value)
      return options.find((o) => o.toLowerCase() === s.toLowerCase()) ?? null
    }
  }
}

/** The value as the category sees it now: stored values are converted on read, so changing a kind never destroys data. */
export function readValue(category: Category, entity: EntityBase): CategoryValue {
  return coerceValue(category.kind, entity.categories[category.id], category.options)
}

/**
 * Rewrite stored dropdown values after options were renamed (`{ old: new }`).
 * Returns the same entity object when nothing changed.
 */
export function renameValues<E extends EntityBase>(entity: E, categoryId: Id, renamed: Record<string, string>): E {
  const value = entity.categories[categoryId]
  if (typeof value !== 'string' || !Object.hasOwn(renamed, value)) return entity
  return { ...entity, categories: { ...entity.categories, [categoryId]: renamed[value] } }
}

/** Display text for a stored value, '' when empty or not valid for the category's kind. */
export function formatValue(category: Category, raw: CategoryValue | undefined): string {
  const value = coerceValue(category.kind, raw, category.options)
  if (value === null || value === '') return ''
  if (category.kind === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

/** Sort comparator for values of one category; empty values sort last. */
export function compareValues(category: Category, rawA: CategoryValue | undefined, rawB: CategoryValue | undefined): number {
  const a = coerceValue(category.kind, rawA, category.options)
  const b = coerceValue(category.kind, rawB, category.options)
  const ea = a === null || a === ''
  const eb = b === null || b === ''
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
  if (category.kind === 'number') return Number(a) - Number(b)
  if (category.kind === 'dropdown') {
    // Options are ordered by the user (e.g. Common < Rare), so sort by that order.
    return category.options.indexOf(String(a)) - category.options.indexOf(String(b))
  }
  if (category.kind === 'boolean') return Number(b) - Number(a)
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })
}

/** A filter on one category (IT-8). `value` null means "has any value". */
export interface CategoryFilter {
  categoryId: Id
  value: string | null
}

/** Special filter value: entities where the category is shown but empty. */
export const EMPTY_FILTER = '\u0000empty'

export function matchesFilter(
  categories: Category[],
  type: EntityType,
  entity: EntityBase,
  filter: CategoryFilter | null,
): boolean {
  if (!filter) return true
  const category = categories.find((c) => c.id === filter.categoryId)
  if (!category) return true
  if (!categoryAppliesTo(category, type, entity.id)) return false
  const shown = formatValue(category, entity.categories[category.id])
  if (filter.value === null) return shown !== ''
  if (filter.value === EMPTY_FILTER) return shown === ''
  if (category.kind === 'text') return shown.toLowerCase().includes(filter.value.toLowerCase())
  return shown === filter.value
}

/** Distinct non-empty display values of a category across entities, for a filter dropdown. */
export function distinctValues(category: Category, type: EntityType, entities: EntityBase[]): string[] {
  if (category.kind === 'dropdown') return category.options
  if (category.kind === 'boolean') return ['Yes', 'No']
  const values = new Set<string>()
  for (const e of entities) {
    if (!categoryAppliesTo(category, type, e.id)) continue
    const v = formatValue(category, e.categories[category.id])
    if (v) values.add(v)
  }
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}
