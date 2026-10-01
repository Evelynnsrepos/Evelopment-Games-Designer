import type { EntityType, Id } from '@/core/model'
import { createEntityActions, openEntity } from '@/shared/entityList'
import { openWikiArticleForEntity } from '@/shared/wiki'

/** Character List commands with undo/redo (spec 3.5). */
export const characterActions = createEntityActions('character')

/** Open another entity in its own list. */
export function goTo(type: EntityType, id: Id) {
  openEntity(type, id)
}

/** Ask the Wiki to create an article for this entity (CH-6, WK-2). */
export function openWiki(type: EntityType, id: Id) {
  openWikiArticleForEntity(type, id)
}
