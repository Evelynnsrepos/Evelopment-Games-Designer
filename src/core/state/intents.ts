import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import type { ComponentType } from '../model'

/**
 * One-shot requests from one tool to another, e.g. the Character List asking
 * the Wiki to open (or create) the article for a character (WK-2, CH-6, EN-7).
 * Components never import each other, so the sender posts an intent here and
 * opens the target with `openComponent`; the target handles it once mounted.
 *
 *   openComponent('wiki'); postIntent('wiki', { action: 'article-for-entity', entityType: 'character', entityId })
 *
 * Each component documents the intents it understands next to its View.
 */
export interface Intent {
  action: string
  [key: string]: unknown
}

const useIntents = create<{ queue: Partial<Record<ComponentType, Intent[]>> }>()(() => ({ queue: {} }))

export function postIntent(type: ComponentType, intent: Intent) {
  useIntents.setState((s) => ({ queue: { ...s.queue, [type]: [...(s.queue[type] ?? []), intent] } }))
}

/** Remove and return every pending intent for a component. */
export function takeIntents(type: ComponentType): Intent[] {
  const pending = useIntents.getState().queue[type] ?? []
  if (pending.length) useIntents.setState((s) => ({ queue: { ...s.queue, [type]: [] } }))
  return pending
}

/** Handle intents for `type` as they arrive. Pass `ready = false` until the component can act (e.g. still loading). */
export function useIntentHandler(type: ComponentType, handler: (intent: Intent) => void, ready = true) {
  const pending = useIntents((s) => s.queue[type]?.length ?? 0)
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  useEffect(() => {
    if (!ready || !pending) return
    for (const intent of takeIntents(type)) handlerRef.current(intent)
  }, [type, ready, pending])
}

/** Drop pending intents, e.g. when a project closes. */
export function clearIntents() {
  useIntents.setState({ queue: {} })
}
