/**
 * Sketch actions (Sketch Pro): everything a shortcut key, a pen button or a
 * QuickMenu slot can do. The editor supplies what each action does; this
 * module only names them and matches keys.
 */

export const ACTIONS = [
  { id: 'tool.brush', label: 'Brush', keys: ['b'] },
  { id: 'tool.eraser', label: 'Eraser', keys: ['e'] },
  { id: 'tool.smudge', label: 'Smudge', keys: ['s'] },
  { id: 'tool.lasso', label: 'Lasso selection', keys: ['l'] },
  { id: 'tool.rect', label: 'Rectangle selection', keys: ['m'] },
  { id: 'tool.move', label: 'Move', keys: ['v'] },
  { id: 'tool.eyedropper', label: 'Eyedropper', keys: ['i'] },
  { id: 'tool.hand', label: 'Pan', keys: ['h'] },
  { id: 'swapEraser', label: 'Switch brush / eraser', keys: ['x'] },
  { id: 'undo', label: 'Undo', keys: ['ctrl+z'] },
  { id: 'redo', label: 'Redo', keys: ['ctrl+y', 'ctrl+shift+z'] },
  { id: 'sizeUp', label: 'Bigger brush', keys: [']'] },
  { id: 'sizeDown', label: 'Smaller brush', keys: ['['] },
  { id: 'deselect', label: 'Deselect', keys: ['ctrl+d'] },
  { id: 'clear', label: 'Clear selection or layer', keys: ['delete', 'backspace'] },
  { id: 'fill', label: 'Fill with color', keys: [] },
  { id: 'newLayer', label: 'New layer', keys: ['ctrl+shift+n'] },
  { id: 'flipLayerX', label: 'Flip layer horizontally', keys: [] },
  { id: 'flipLayerY', label: 'Flip layer vertically', keys: [] },
  { id: 'fit', label: 'Fit to view', keys: ['0'] },
  { id: 'rotateLeft', label: 'Turn view left', keys: [','] },
  { id: 'rotateRight', label: 'Turn view right', keys: ['.'] },
  { id: 'flipView', label: 'Mirror view', keys: ['shift+h'] },
  { id: 'quickMenu', label: 'QuickMenu', keys: ['q'] },
  { id: 'guides', label: 'Show / hide drawing guide', keys: [] },
  { id: 'assist', label: 'Drawing Assist on / off', keys: [] },
  { id: 'export', label: 'Export as PNG', keys: [] },
  { id: 'inputSettings', label: 'Pen and keys settings', keys: [] },
  // Canvas, time-lapse and files (feat/sketch-files)
  { id: 'canvasSettings', label: 'Canvas: crop, resize and info', keys: [] },
  { id: 'flipCanvasX', label: 'Flip canvas horizontally', keys: [] },
  { id: 'flipCanvasY', label: 'Flip canvas vertically', keys: [] },
  { id: 'importFile', label: 'Import a file', keys: [] },
  { id: 'timelapse', label: 'Time-lapse replay', keys: [] },
  { id: 'companion', label: 'Reference Companion', keys: [] },
] as const satisfies readonly { id: string; label: string; keys: readonly string[] }[]

export type ActionId = (typeof ACTIONS)[number]['id']

export const actionLabel = (id: ActionId) => ACTIONS.find((a) => a.id === id)?.label ?? id

/** Tool actions; on a pen button they mean "use this tool while the button is held". */
export const toolOf = (id: ActionId) => (id.startsWith('tool.') ? id.slice(5) : null)

/** User changes on top of the defaults: action -> its keys ([] = no key). */
export type ShortcutMap = Partial<Record<ActionId, string[]>>

export function keysFor(id: ActionId, custom: ShortcutMap): readonly string[] {
  return custom[id] ?? ACTIONS.find((a) => a.id === id)?.keys ?? []
}

const NAMES: Record<string, string> = { ' ': 'space', escape: 'esc', arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down' }

/** "ctrl+shift+z" for a key event; null for a bare modifier key. Cmd counts as Ctrl. */
export function comboOf(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): string | null {
  const k = e.key.toLowerCase()
  if (['control', 'meta', 'alt', 'shift', 'altgraph', 'os'].includes(k)) return null
  const mods = [e.ctrlKey || e.metaKey ? 'ctrl' : '', e.altKey ? 'alt' : '', e.shiftKey ? 'shift' : ''].filter(Boolean)
  return [...mods, NAMES[k] ?? k].join('+')
}

/** The action a key event runs, if any. */
export function matchShortcut(e: Parameters<typeof comboOf>[0], custom: ShortcutMap): ActionId | null {
  const combo = comboOf(e)
  if (!combo) return null
  return ACTIONS.find((a) => keysFor(a.id, custom).includes(combo))?.id ?? null
}

/** Readable key name, e.g. "Ctrl+Shift+Z". */
export function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((p) => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join('+')
}

/** Other actions already using `combo`, to warn before assigning it twice. */
export function conflicts(combo: string, except: ActionId, custom: ShortcutMap): ActionId[] {
  return ACTIONS.filter((a) => a.id !== except && keysFor(a.id, custom).includes(combo)).map((a) => a.id)
}

// ---- QuickMenu ---------------------------------------------------------------

export const QUICK_SLOTS = 6

export interface QuickMenuProfile {
  id: string
  name: string
  /** Exactly QUICK_SLOTS entries, clockwise from the top; null = empty slot. */
  slots: (ActionId | null)[]
}

export const DEFAULT_QUICK_MENU: QuickMenuProfile = {
  id: 'default',
  name: 'Basic',
  slots: ['undo', 'redo', 'swapEraser', 'newLayer', 'flipView', 'fit'],
}

/** Clean up a saved profile: right number of slots, unknown actions removed. */
export function normalizeProfile(p: Partial<QuickMenuProfile> & { id: string }): QuickMenuProfile {
  const valid = new Set<string>(ACTIONS.map((a) => a.id))
  const slots = Array.from({ length: QUICK_SLOTS }, (_, i) => {
    const s = p.slots?.[i]
    return s && valid.has(s) ? s : null
  })
  return { id: p.id, name: p.name || 'Menu', slots }
}
