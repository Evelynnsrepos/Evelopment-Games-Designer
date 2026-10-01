import { useEffect, useState } from 'react'
import type { CanvasTheme } from './types'

/** Konva needs concrete colors, so read the CSS theme tokens and follow theme switches. */
export function readCanvasTheme(): CanvasTheme {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    bg: v('--bg', '#15161a'),
    bgElevated: v('--bg-elevated', '#1d1f24'),
    bgSunken: v('--bg-sunken', '#101114'),
    border: v('--border', '#2c2f37'),
    text: v('--text', '#e6e7eb'),
    textMuted: v('--text-muted', '#9a9ea9'),
    accent: v('--accent', '#d46cf0'),
    danger: v('--danger', '#ef5d6c'),
    focus: v('--focus', '#8fb4ff'),
    font: v('--font', 'system-ui, sans-serif'),
  }
}

export function useCanvasTheme(): CanvasTheme {
  const [theme, setTheme] = useState(readCanvasTheme)
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readCanvasTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] })
    return () => observer.disconnect()
  }, [])
  return theme
}
