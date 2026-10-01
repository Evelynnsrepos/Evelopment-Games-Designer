import { create } from 'zustand'

/** Light/dark theme, dark by default (spec 10.5). Remembered per machine. */
export type Theme = 'dark' | 'light'

const KEY = 'egd-theme'

function initial(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const useThemeStore = create<{ theme: Theme }>()(() => ({ theme: initial() }))

export function applyTheme() {
  document.documentElement.dataset.theme = useThemeStore.getState().theme
}

export function toggleTheme() {
  const theme: Theme = useThemeStore.getState().theme === 'dark' ? 'light' : 'dark'
  useThemeStore.setState({ theme })
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // ignore
  }
  applyTheme()
}

export const useTheme = () => useThemeStore((s) => s.theme)
