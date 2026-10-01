import { create } from 'zustand'
import type { ComponentType, EntityType, Id } from '@/core/model'

/**
 * Cross-component requests about entities, so lists and the Wiki can hand each
 * other work without importing one another (AGENTS.md rule 3):
 *
 * - focus: "show this entity" — the list of that type selects it and opens its page.
 * - wiki:  "create a wiki article for this entity" (CH-6, EN-7, WK-2) — the Wiki takes
 *   it with `takeWikiArticleRequest()` when it opens.
 *
 * Callers set the request, then open the target with `openComponent(ENTITY_COMPONENT[type])`.
 */
export interface EntityRequest {
  type: EntityType
  id: Id
  /** Increases on every request so asking twice for the same entity still fires. */
  seq: number
}

interface NavigationState {
  focus: EntityRequest | null
  wiki: EntityRequest | null
}

export const useEntityNavigation = create<NavigationState>()(() => ({ focus: null, wiki: null }))

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

export function requestWikiArticle(type: EntityType, id: Id) {
  useEntityNavigation.setState({ wiki: { type, id, seq: ++seq } })
}

/** For the Wiki: take the pending "create article for entity" request, if any. */
export function takeWikiArticleRequest(): EntityRequest | null {
  const wiki = useEntityNavigation.getState().wiki
  if (wiki) useEntityNavigation.setState({ wiki: null })
  return wiki
}
