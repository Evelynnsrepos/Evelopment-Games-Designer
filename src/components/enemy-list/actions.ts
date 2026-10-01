import { newId, type DropRow, type EntityType, type Id } from '@/core/model'
import { openComponent } from '@/shell/editor/actions'
import { createEntityActions, ENTITY_COMPONENT, requestEntityFocus, requestWikiArticle } from '@/shared/entityList'

/** Enemy List commands with undo/redo (spec 3.5). */
export const enemyActions = createEntityActions('enemy')

/** Open another entity in its own list. */
export function goTo(type: EntityType, id: Id) {
  requestEntityFocus(type, id)
  openComponent(ENTITY_COMPONENT[type])
}

/** Ask the Wiki to create an article for this enemy (EN-7, WK-2). */
export function openWiki(type: EntityType, id: Id) {
  requestWikiArticle(type, id)
  openComponent('wiki')
}

/** A new drop row: one of the item, always drops (EN-4). */
export function newDropRow(itemId: Id = ''): DropRow {
  return { id: newId(), itemId, amountMin: 1, amountMax: 1, chancePercent: 100 }
}
