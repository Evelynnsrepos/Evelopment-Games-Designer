import { create } from 'zustand'

/** Whether the Settings dialog is open; opened from the start screen and the sidebar. */
export const useSettingsDialog = create<{ open: boolean }>()(() => ({ open: false }))
export const openSettings = () => useSettingsDialog.setState({ open: true })
