import { comboOf, conflicts, formatCombo, matchShortcut, normalizeProfile, QUICK_SLOTS } from './actions'

const key = (k: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }> = {}) => ({
  key: k,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
})

describe('shortcuts', () => {
  it('builds combos', () => {
    expect(comboOf(key('Z', { ctrl: true, shift: true }))).toBe('ctrl+shift+z')
    expect(comboOf(key('z', { meta: true }))).toBe('ctrl+z')
    expect(comboOf(key(' '))).toBe('space')
    expect(comboOf(key('Shift', { shift: true }))).toBe(null)
  })
  it('matches defaults and custom keys', () => {
    expect(matchShortcut(key('z', { ctrl: true }), {})).toBe('undo')
    expect(matchShortcut(key('Z', { ctrl: true, shift: true }), {})).toBe('redo')
    expect(matchShortcut(key('b'), {})).toBe('tool.brush')
    expect(matchShortcut(key('b', { ctrl: true }), {})).toBe(null)
    expect(matchShortcut(key('z', { ctrl: true }), { undo: ['u'] })).toBe(null)
    expect(matchShortcut(key('u'), { undo: ['u'] })).toBe('undo')
  })
  it('formats and finds conflicts', () => {
    expect(formatCombo('ctrl+shift+z')).toBe('Ctrl+Shift+Z')
    expect(conflicts('b', 'undo', {})).toEqual(['tool.brush'])
    expect(conflicts('b', 'tool.brush', {})).toEqual([])
  })
  it('normalizes QuickMenu profiles', () => {
    const p = normalizeProfile({ id: 'x', slots: ['undo', 'nope' as never] })
    expect(p.slots).toHaveLength(QUICK_SLOTS)
    expect(p.slots[0]).toBe('undo')
    expect(p.slots[1]).toBe(null)
    expect(p.name).toBe('Menu')
  })
})
