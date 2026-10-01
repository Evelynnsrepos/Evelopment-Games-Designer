import { newId, type ComponentType, type Id } from '@/core/model'
import { getManifest } from '@/core/registry'
import { clearDocumentCache, flushAll, useAppStore, useProjectStore } from '@/core/state'
import { autoPlacement, findOpen, insertPanel, neighbor, removePanel, swapPanels, type Direction, type DropSide } from '../workspace/layoutTree'

/**
 * Editor commands shared by the sidebar, workspace and keyboard handling.
 * Feature modules may call `openComponent` to open other tools (e.g. the
 * Wiki opening an entity's list).
 */

export interface Placement {
  targetId: Id | null
  side: DropSide
}

/** Open a component (and document). Focuses it if already open (ED-10). */
export function openComponent(type: ComponentType, documentId: Id | null = null, placement?: Placement) {
  const project = useProjectStore.getState()
  const app = useAppStore.getState()
  if (!project.meta) return
  const manifest = getManifest(type)
  project.enableComponent(type)

  let docId = documentId
  if (manifest?.multiDocument && !docId) {
    const existing = useProjectStore.getState().meta!.documents.find((d) => d.type === type)
    docId = existing ? existing.id : project.addDocument(type, manifest.newDocumentTitle ?? 'Untitled').id
  }
  if (!manifest?.multiDocument) docId = null

  const layout = useProjectStore.getState().meta!.layout
  const open = findOpen(layout, type, docId)
  if (open) {
    app.setActivePanel(open.id)
    return
  }
  const panel = { id: newId(), type, documentId: docId }
  const where = placement ?? autoPlacement(layout, window.innerWidth / Math.max(1, window.innerHeight))
  useProjectStore.getState().setLayout(insertPanel(layout, panel, where.targetId, where.side))
  app.setActivePanel(panel.id)
}

/** Create a new document for a multi-document component and open it (SB-4). */
export function newDocument(type: ComponentType) {
  const manifest = getManifest(type)
  const doc = useProjectStore.getState().addDocument(type, manifest?.newDocumentTitle ?? 'Untitled')
  openComponent(type, doc.id)
}

/** Close a panel; everything is saved first (ED-8). */
export async function closePanel(panelId: Id) {
  const { root, meta } = useProjectStore.getState()
  if (!root || !meta) return
  await flushAll(root)
  const layout = useProjectStore.getState().meta!.layout
  useProjectStore.getState().setLayout(removePanel(layout, panelId))
  const app = useAppStore.getState()
  if (app.activePanelId === panelId) app.setActivePanel(null)
}

/** Swap a panel with its neighbour (ED-6 arrows). */
export function movePanel(panelId: Id, dir: Direction) {
  const layout = useProjectStore.getState().meta?.layout ?? null
  const other = neighbor(layout, panelId, dir)
  if (layout && other) useProjectStore.getState().setLayout(swapPanels(layout, panelId, other.id))
}

/** Restore the last layout, or open the first enabled component for a new project (ED-1). */
export function openInitialLayout() {
  const meta = useProjectStore.getState().meta
  if (!meta || meta.layout) return
  const first = meta.enabledComponents[0]
  if (first) openComponent(first)
}

/** Save everything and return to the launcher (SB-7). */
export async function backToProjects() {
  await useProjectStore.getState().close()
  clearDocumentCache()
  useAppStore.getState().setActivePanel(null)
  useAppStore.getState().go('launcher')
}

/** Drag-and-drop payload from the sidebar (SB-3, ED-2). */
export const DRAG_MIME = 'application/x-egd-component'
export interface DragPayload {
  type: ComponentType
  documentId: Id | null
}
