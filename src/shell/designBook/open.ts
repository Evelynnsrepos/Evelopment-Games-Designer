import { create } from 'zustand'

/** Whether the Design Book dialog is open; opened from the sidebar and Ctrl+K. */
export const useDesignBook = create<{ open: boolean }>()(() => ({ open: false }))
export const openDesignBook = () => useDesignBook.setState({ open: true })
