import { create } from 'zustand'

/** Whether the engine export window is open; from the sidebar and Ctrl+K. */
export const useEngineExport = create<{ open: boolean }>()(() => ({ open: false }))
