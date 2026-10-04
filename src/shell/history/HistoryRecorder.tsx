import { useEffect } from 'react'
import { ENTITY_TYPES, type Entity, type Id } from '@/core/model'
import { loadDocumentNow, updateDocument, useProjectStore } from '@/core/state'
import { addSnapshot, createHistoryDoc, HISTORY_DOC, type HistoryDoc } from '@/shared/history'

/**
 * Records entry history in the background (v0.10): when an item, character,
 * town or enemy changes, a version is saved a few seconds later.
 */
export function HistoryRecorder() {
  useEffect(() => {
    let pending = new Map<Id, { entity: Entity; before: Entity }>()
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = async () => {
      const root = useProjectStore.getState().root
      const batch = pending
      pending = new Map()
      if (!root || !batch.size) return
      await loadDocumentNow<HistoryDoc>(root, HISTORY_DOC.type, HISTORY_DOC.id, createHistoryDoc)
      const now = new Date()
      updateDocument<HistoryDoc>(root, HISTORY_DOC.type, HISTORY_DOC.id, (h) => [...batch.values()].reduce((acc, c) => addSnapshot(acc, c.entity, now, c.before), h), { undoable: false })
    }
    const unsubscribe = useProjectStore.subscribe((s, prev) => {
      if (s.root !== prev.root || s.entities === prev.entities) return
      for (const type of ENTITY_TYPES) {
        const next = s.entities[type] as Entity[]
        const old = prev.entities[type] as Entity[]
        if (next === old) continue
        const before = new Map(old.map((e) => [e.id, e]))
        for (const e of next) {
          const b = before.get(e.id)
          // Only edits of existing entries; brand-new ones have nothing to go back to yet.
          if (b && b !== e) pending.set(e.id, { entity: e, before: pending.get(e.id)?.before ?? b })
        }
      }
      if (pending.size) {
        clearTimeout(timer)
        timer = setTimeout(() => void flush(), 3000)
      }
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
      void flush()
    }
  }, [])
  return null
}
