import type { BoardNode } from './model'

/**
 * User content colors (fixed values are allowed for content, AGENTS.md).
 * `strong` is used for pins, string, areas and ink; `soft` for sticky notes.
 */
export interface BoardColor {
  label: string
  strong: string
  soft: string
}

export const BOARD_COLORS: BoardColor[] = [
  { label: 'Red', strong: '#e5484d', soft: '#ff9ea2' },
  { label: 'Orange', strong: '#f08c2e', soft: '#ffb38a' },
  { label: 'Yellow', strong: '#e8b923', soft: '#ffe27a' },
  { label: 'Green', strong: '#30a46c', soft: '#9ef0b0' },
  { label: 'Blue', strong: '#3e8ef7', soft: '#8fd3ff' },
  { label: 'Purple', strong: '#8e6cf0', soft: '#b9a6ff' },
  { label: 'Pink', strong: '#e5539d', soft: '#ff9ec7' },
  { label: 'Grey', strong: '#80838d', soft: '#d6d8de' },
]

/** Defaults when no color is picked ("Auto"). */
export const DEFAULT_PIN_COLOR = '#e5484d'
export const DEFAULT_STRING_COLOR = '#d13438'
export const DEFAULT_AREA_COLOR = '#3e8ef7'

/** The color fields a picked color sets on each kind (null = back to defaults). */
export function colorPatch(n: BoardNode, c: BoardColor | null): Partial<BoardNode> | null {
  switch (n.kind) {
    case 'note':
      return { fillColor: c?.soft }
    case 'pin':
      return { pinColor: c?.strong }
    case 'string':
    case 'rect':
    case 'ellipse':
    case 'line':
    case 'connector':
      return { strokeColor: c?.strong }
    case 'area':
      return { areaColor: c?.strong }
    case 'text':
      return { textColor: c?.strong }
    default:
      return null
  }
}

/** Dark or light text, whichever reads better on `hex`. */
export function textOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#1c1d22'
  const v = parseInt(m[1], 16)
  const lum = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255
  return lum > 0.6 ? '#1c1d22' : '#ffffff'
}
