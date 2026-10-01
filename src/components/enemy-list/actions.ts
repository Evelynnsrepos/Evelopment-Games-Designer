import { newId, type DropRow, type EntityType, type Id } from '@/core/model'
import { createEntityActions, openEntity } from '@/shared/entityList'
import { openWikiArticleForEntity } from '@/shared/wiki'

/** Enemy List commands with undo/redo (spec 3.5). */
export const enemyActions = createEntityActions('enemy')

/** Open another entity in its own list. */
export function goTo(type: EntityType, id: Id) {
  openEntity(type, id)
}

/** Ask the Wiki to create an article for this enemy (EN-7, WK-2). */
export function openWiki(type: EntityType, id: Id) {
  openWikiArticleForEntity(type, id)
}

/** A new drop row: one of the item, always drops (EN-4). */
export function newDropRow(itemId: Id = ''): DropRow {
  return { id: newId(), itemId, amountMin: 1, amountMax: 1, chancePercent: 100 }
}
