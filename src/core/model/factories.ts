import type { Category, CategoryKind, EntityOf, EntityType } from './entities'
import { newId } from './ids'

const now = () => new Date().toISOString()

function base(name: string) {
  const t = now()
  return { id: newId(), name, description: '', notes: '', image: null, categories: {}, createdAt: t, updatedAt: t }
}

/** Create a blank entity of the given type with sensible defaults. */
export function createEntity<T extends EntityType>(type: T, name = 'Untitled'): EntityOf<T> {
  switch (type) {
    case 'item':
      return { ...base(name), type, stats: {} } as EntityOf<T>
    case 'character':
      return { ...base(name), type, links: [] } as unknown as EntityOf<T>
    case 'town':
      return { ...base(name), type, links: [] } as unknown as EntityOf<T>
    case 'enemy':
      return {
        ...base(name),
        type,
        levelMin: 1,
        levelMax: 1,
        stats: { HP: 100, ATK: 10, DEF: 0 },
        growth: [],
        resistances: {},
        dropTable: [],
        timeToDefeatSeconds: null,
        respawnNote: '',
        foundIn: [],
      } as unknown as EntityOf<T>
  }
  throw new Error(`Unknown entity type: ${String(type)}`)
}

export function createCategory(name: string, kind: CategoryKind, options: string[] = []): Category {
  return { id: newId(), name, kind, options, appliesTo: {}, builtIn: false }
}

/** Built-in categories from spec 3.4. Shared across entity types, so "Nation" exists once. */
export function builtInCategories(): Category[] {
  const all = { mode: 'all' } as const
  const make = (name: string, kind: CategoryKind, types: EntityType[], options: string[] = []): Category => ({
    id: newId(),
    name,
    kind,
    options,
    appliesTo: Object.fromEntries(types.map((t) => [t, all])),
    builtIn: true,
  })
  return [
    {
      ...make('Rarity', 'dropdown', ['item', 'character'], ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']),
      // Pre-saved looks (v0.6); kept in step with DEFAULT_RARITY_STYLES in shared/categories/styles.tsx.
      styles: {
        Common: { color: '#9aa0a6', border: 'none', icon: null },
        Uncommon: { color: '#30a46c', border: 'solid', icon: null },
        Rare: { color: '#3e8ef7', border: 'solid', icon: 'gem' },
        Epic: { color: '#a855f7', border: 'double', icon: 'sparkles' },
        Legendary: { color: '#f5a623', border: 'glow', icon: 'crown' },
      },
    },
    make('Value', 'number', ['item']),
    make('State of Repair', 'dropdown', ['item'], ['Broken', 'Worn', 'Good', 'Pristine']),
    make('Family', 'text', ['character']),
    make('Nation', 'text', ['character', 'town', 'enemy']),
    make('Clan', 'text', ['character']),
    make('Race', 'text', ['character', 'town', 'enemy']),
    make('Religion', 'text', ['town']),
    make('Faction', 'text', ['enemy']),
    make('Region', 'text', ['enemy']),
    make('Element', 'text', ['enemy']),
  ]
}

/** Does `category` apply to the entity with this id? (IT-5) */
export function categoryAppliesTo(category: Category, type: EntityType, entityId: string): boolean {
  const scope = category.appliesTo[type]
  if (!scope || scope.mode === 'none') return false
  return scope.mode === 'all' || scope.ids.includes(entityId)
}
