import type { Character, Entity, EntityLink, EntityType, Id, Town } from '@/core/model'
import type { EntityCollections } from '@/core/project'

/** Ready-made link labels; the user can type anything (CH-5, 8.12 "Lives in"). */
export const LINK_SUGGESTIONS: Record<'character' | 'town', string[]> = {
  character: ['Mother of', 'Father of', 'Child of', 'Sibling of', 'Married to', 'Friend of', 'Rival of', 'Mentor of', 'Serves', 'Lives in', 'Born in', 'Rules'],
  town: ['Ruled by', 'Capital of', 'Allied with', 'At war with', 'Trades with', 'Near'],
}

export const TYPE_LABEL: Record<EntityType, string> = { item: 'Item', character: 'Character', town: 'Town', enemy: 'Enemy' }

/** A link from some entity to the one being viewed ("Linked from"). */
export interface Backlink {
  source: Character | Town
  link: EntityLink
}

/** Characters and towns whose links point at `targetId`, sorted by name. */
export function backlinksTo(targetId: Id, collections: EntityCollections): Backlink[] {
  const out: Backlink[] = []
  for (const source of [...collections.character, ...collections.town]) {
    for (const link of source.links ?? []) if (link.targetId === targetId && source.id !== targetId) out.push({ source, link })
  }
  return out.sort((a, b) => a.source.name.localeCompare(b.source.name) || a.link.label.localeCompare(b.link.label))
}

export function findEntity(collections: EntityCollections, type: EntityType, id: Id): Entity | undefined {
  return (collections[type] as Entity[]).find((e) => e.id === id)
}

/** Names of link targets, for search ("Lives in Ironhold" finds the character). */
export function linkSearchText(links: EntityLink[] | undefined, collections: EntityCollections): string[] {
  return (links ?? []).flatMap((l) => [l.label, findEntity(collections, l.targetType, l.targetId)?.name ?? ''])
}
