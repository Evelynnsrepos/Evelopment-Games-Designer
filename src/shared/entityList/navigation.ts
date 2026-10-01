import { create } from 'zustand'
import type { ComponentType, EntityType, Id } from '@/core/model'
import { openComponent } from '@/shell/editor/actions'

/**
 * Cross-component requests about entities, so lists and the Wiki can hand each
 * other work without importing one another (AGENTS.md rule 3):
 *
 * - focus: "show this entity" — the list of that type selects it and opens its page.
 *
 * Use `openEntity(type, id)` to do both in one call. For "create a wiki article for this
 * entity" (CH-6, EN-7, WK-2) use `openWikiArticleForEntity` from `@/shared/wiki`.
 */
export interface EntityRequest {
  type: EntityType
  id: Id
  /** Increases on every request so asking twice for the same entity still fires. */
  seq: number
}

interface NavigationState {
  focus: EntityRequest | null
}

export const useEntityNavigation = create<NavigationState>()(() => ({ focus: null }))

let seq = 0

/** The component that lists each entity type. */
export const ENTITY_COMPONENT: Record<EntityType, ComponentType> = {
  item: 'item-list',
  character: 'character-list',
  town: 'town-list',
  enemy: 'enemy-list',
}

export function requestEntityFocus(type: EntityType, id: Id) {
  useEntityNavigation.setState({ focus: { type, id, seq: ++seq } })
}

/** Take the pending focus request for `type`, if any. */
export function takeEntityFocus(type: EntityType): EntityRequest | null {
  const focus = useEntityNavigation.getState().focus
  if (!focus || focus.type !== type) return null
  useEntityNavigation.setState({ focus: null })
  return focus
}

/** Open the list for `type` with this entity selected. */
export function openEntity(type: EntityType, id: Id) {
  requestEntityFocus(type, id)
  openComponent(ENTITY_COMPONENT[type])
}
