import { create } from 'zustand'

/** Which top-level screen is showing. */
export type Screen = 'launcher' | 'new-project' | 'editor'

interface AppState {
  screen: Screen
  /** Esc toggles Layout Mode in the editor (ED-5). */
  layoutMode: boolean
  /** Panel that receives keyboard shortcuts (spec 10.4). */
  activePanelId: string | null
  go(screen: Screen): void
  setLayoutMode(on: boolean): void
  setActivePanel(id: string | null): void
}

export const useAppStore = create<AppState>()((set) => ({
  screen: 'launcher',
  layoutMode: false,
  activePanelId: null,
  go: (screen) => set({ screen, layoutMode: false }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setActivePanel: (activePanelId) => set({ activePanelId }),
}))
