import { getFs } from '@/core/fs'
import { ENTITY_TYPES, type ComponentType } from '@/core/model'
import { projectPaths } from '@/core/project'
import { flushAll, forgetDocuments, useProjectStore } from '@/core/state'
import { ENTITY_COMPONENT } from '@/shared/entityList/navigation'
import { leaves } from '../workspace/layoutTree'
import { closePanel } from './actions'

/** Closing, hiding and deleting whole tools (v0.3). Hidden tools keep their files; deleting removes them. */

const entityTypeOf = (type: ComponentType) => ENTITY_TYPES.find((t) => ENTITY_COMPONENT[t] === type)

/** Does the project hold anything made with this tool (documents, list entries or saved files)? */
export async function toolHasContent(type: ComponentType): Promise<boolean> {
  const { root, meta, entities } = useProjectStore.getState()
  if (!root || !meta) return false
  if (meta.documents.some((d) => d.type === type)) return true
  const entityType = entityTypeOf(type)
  if (entityType && entities[entityType].length > 0) return true
  const fs = getFs()
  const dir = await projectPaths.componentDir(root, type)
  return (await fs.exists(dir)) && (await fs.list(dir)).some((e) => e.name.endsWith('.json'))
}

/** Remove the tool from the sidebar and close its panels; everything it made stays in the project. */
export async function hideTool(type: ComponentType) {
  for (const p of leaves(useProjectStore.getState().meta?.layout ?? null)) if (p.type === type) await closePanel(p.id)
  const meta = useProjectStore.getState().meta
  if (meta) useProjectStore.getState().updateMeta({ enabledComponents: meta.enabledComponents.filter((t) => t !== type) })
}

/** Permanently delete everything the tool made. Does not hide or show the tool. */
export async function deleteToolContent(type: ComponentType) {
  const store = useProjectStore.getState()
  const root = store.root
  if (!root || !store.meta) return
  await flushAll(root)
  for (const d of store.meta.documents.filter((d) => d.type === type)) await useProjectStore.getState().removeDocument(d.id)
  const entityType = entityTypeOf(type)
  if (entityType) useProjectStore.getState().setEntities(entityType, [])
  await flushAll(root)
  await getFs().remove(await projectPaths.componentDir(root, type))
  forgetDocuments(type)
}
