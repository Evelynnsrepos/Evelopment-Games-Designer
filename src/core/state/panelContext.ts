import { createContext, useContext } from 'react'
import type { Panel } from '../model'

/**
 * The panel a component view is rendered in, provided by the workspace.
 * Shared editors (canvas, rich text) use it to tell teammates where you are.
 */
export const PanelContext = createContext<Panel | null>(null)

export function usePanelContext(): Panel | null {
  return useContext(PanelContext)
}

/** Stable key for what a panel shows, e.g. `brainstorm/<id>` or `item-list`. */
export function panelKey(panel: Pick<Panel, 'type' | 'documentId'> | null): string | null {
  if (!panel) return null
  return panel.documentId ? `${panel.type}/${panel.documentId}` : panel.type
}
