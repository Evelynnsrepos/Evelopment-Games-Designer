import type { EntityType, Id } from '@/core/model'
import { openComponent } from '@/shell/editor/actions'
import { createEntityActions, ENTITY_COMPONENT, requestEntityFocus, requestWikiArticle } from '@/shared/entityList'

/** Character List commands with undo/redo (spec 3.5). */
export const characterActions = createEntityActions('character')

/** Open another entity in its own list. */
export function goTo(type: EntityType, id: Id) {
  requestEntityFocus(type, id)
  openComponent(ENTITY_COMPONENT[type])
}

/** Ask the Wiki to create an article for this entity (CH-6, WK-2). */
export function openWiki(type: EntityType, id: Id) {
  requestWikiArticle(type, id)
  openComponent('wiki')
}
