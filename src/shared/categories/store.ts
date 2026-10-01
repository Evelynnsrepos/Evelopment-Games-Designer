import { ENTITY_TYPES, type EntityBase, type EntityOf, type EntityType, type Id } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { renameValues } from './logic'

/**
 * After dropdown options were renamed, rewrite stored values on every entity of
 * the given types so "Fire" -> "Flame" keeps its selections.
 */
export function renameOptionValues(categoryId: Id, renamed: Record<string, string>, types: readonly EntityType[] = ENTITY_TYPES) {
  const store = useProjectStore.getState()
  for (const t of types) {
    const list = store.entities[t] as EntityBase[]
    let changed = false
    const next = list.map((e) => {
      const r = renameValues(e, categoryId, renamed)
      if (r !== e) changed = true
      return r
    })
    if (changed) store.setEntities(t, next as EntityOf<typeof t>[])
  }
}
