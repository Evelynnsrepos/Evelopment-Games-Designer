import { useMemo } from 'react'
import { ENTITY_TYPES, type Entity, type EntityType } from '@/core/model'
import { allEntities, useProjectStore } from '@/core/state'
import { openComponent } from '@/shell/editor/actions'
import type { RefItem, RefProvider, RefTarget } from './types'

export const MAX_REF_RESULTS = 20

/** Names that start with the query first, then names containing it, each alphabetical. */
export function rankRefItems(items: RefItem[], query: string, limit = MAX_REF_RESULTS): RefItem[] {
  const q = query.trim().toLowerCase()
  const byLabel = (a: RefItem, b: RefItem) => a.label.localeCompare(b.label)
  if (!q) return [...items].sort(byLabel).slice(0, limit)
  const starts: RefItem[] = []
  const contains: RefItem[] = []
  for (const item of items) {
    const label = item.label.toLowerCase()
    if (label.startsWith(q)) starts.push(item)
    else if (label.includes(q)) contains.push(item)
  }
  return [...starts.sort(byLabel), ...contains.sort(byLabel)].slice(0, limit)
}

/** The item whose name equals `label` (case-insensitive), used when `[[Name]]` is typed out in full. */
export function findRefByLabel(provider: RefProvider, label: string): RefItem | undefined {
  const wanted = label.trim().toLowerCase()
  return provider.search(label).find((item) => item.label.trim().toLowerCase() === wanted)
}

/**
 * Merge several providers, e.g. entities plus wiki articles. Search results are
 * re-ranked together; open/resolve go to the first provider that knows the target;
 * create comes from the first provider that offers it.
 */
export function combineRefProviders(...providers: RefProvider[]): RefProvider {
  const creator = providers.find((p) => p.create)
  return {
    search: (query) => rankRefItems(providers.flatMap((p) => p.search(query)), query),
    resolve: (target) => {
      for (const p of providers) {
        const hit = p.resolve(target)
        if (hit) return hit
      }
      return undefined
    },
    open: (target) => providers.find((p) => p.open && p.resolve(target))?.open?.(target),
    create: creator?.create?.bind(creator),
    createLabel: creator?.createLabel?.bind(creator),
  }
}

const ENTITY_HINT: Record<EntityType, string> = { item: 'Item', character: 'Character', town: 'Town', enemy: 'Enemy' }
const ENTITY_LIST: Record<EntityType, 'item-list' | 'character-list' | 'town-list' | 'enemy-list'> = {
  item: 'item-list',
  character: 'character-list',
  town: 'town-list',
  enemy: 'enemy-list',
}

const isEntityType = (kind: string): kind is EntityType => (ENTITY_TYPES as readonly string[]).includes(kind)
const toItem = (e: Entity): RefItem => ({ kind: e.type, id: e.id, label: e.name || 'Untitled', hint: ENTITY_HINT[e.type] })

/** Links to items, characters, towns and enemies of the open project. Clicking one opens its list. */
export function useEntityRefProvider(options?: { open?: (target: RefTarget) => void }): RefProvider {
  const entities = useProjectStore((s) => s.entities)
  const open = options?.open
  return useMemo<RefProvider>(() => {
    const all = allEntities(entities)
    return {
      search: (query) => rankRefItems(all.map(toItem), query),
      resolve: (target) => {
        if (!isEntityType(target.kind)) return undefined
        const hit = (entities[target.kind] as Entity[]).find((e) => e.id === target.id)
        return hit && toItem(hit)
      },
      open: open ?? ((target) => isEntityType(target.kind) && openComponent(ENTITY_LIST[target.kind])),
    }
  }, [entities, open])
}
