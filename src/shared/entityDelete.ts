import type { EntityType, Id } from '@/core/model'
import { findReferences, type Reference } from '@/core/references'
import { getManifest } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import { confirmDialog } from './dialogs'

const ENTITY_LABEL: Record<EntityType, string> = { item: 'Item', character: 'Character', town: 'Town', enemy: 'Enemy' }
const MAX_LISTED = 12

/** "dropTable.itemId" -> "drop table" */
function fieldLabel(field: string) {
  const first = field.split('.')[0]
  return first.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

/** One line describing where a reference is, e.g. `Enemy "Goblin" (drop table)`. */
export function describeReference(ref: Reference): string {
  const s = ref.source
  const where =
    s.kind === 'entity'
      ? `${ENTITY_LABEL[s.entityType]} "${s.name || 'Untitled'}"`
      : `${getManifest(s.componentType)?.name ?? s.componentType}${s.title ? `: "${s.title}"` : ''}`
  const fields = [...new Set(ref.fields.filter(Boolean).map(fieldLabel))]
  return fields.length ? `${where} (${fields.join(', ')})` : where
}

/**
 * Ask before deleting an entity (spec 3.3). If it is used elsewhere, the
 * dialog lists where. Resolves true if the user confirmed.
 */
export async function confirmEntityDelete(type: EntityType, id: Id): Promise<boolean> {
  const entity = useProjectStore.getState().getEntity(type, id)
  const name = entity?.name || 'Untitled'
  const refs = await findReferences(id)
  const title = `Delete ${ENTITY_LABEL[type].toLowerCase()} "${name}"?`
  if (refs.length === 0) {
    return confirmDialog({ title, message: 'It is not used anywhere else in this project.', confirmLabel: 'Delete', danger: true })
  }
  const lines = refs.slice(0, MAX_LISTED).map((r) => `• ${describeReference(r)}`)
  if (refs.length > MAX_LISTED) lines.push(`• …and ${refs.length - MAX_LISTED} more`)
  return confirmDialog({
    title,
    message: `"${name}" is used in ${refs.length} ${refs.length === 1 ? 'place' : 'places'}:\n${lines.join('\n')}\n\nThose places will show it as missing.`,
    confirmLabel: 'Delete anyway',
    danger: true,
  })
}

/** confirmEntityDelete, then remove the entity. Resolves true if it was deleted. */
export async function deleteEntityWithConfirm(type: EntityType, id: Id): Promise<boolean> {
  if (!(await confirmEntityDelete(type, id))) return false
  useProjectStore.getState().removeEntity(type, id)
  return true
}
