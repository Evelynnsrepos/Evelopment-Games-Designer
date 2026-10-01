import { describe, expect, it } from 'vitest'
import { undoRedoAction } from './undoKeys'

const key = (k: string, extra: Partial<Parameters<typeof undoRedoAction>[0]> = {}) =>
  undoRedoAction({ key: k, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, target: null, defaultPrevented: false, ...extra })

describe('undoRedoAction', () => {
  it('maps Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z', () => {
    expect(key('z')).toBe('undo')
    expect(key('y')).toBe('redo')
    expect(key('Z', { shiftKey: true })).toBe('redo')
    expect(key('z', { ctrlKey: false, metaKey: true })).toBe('undo')
  })

  it('ignores other keys, plain Z and handled events', () => {
    expect(key('x')).toBeNull()
    expect(key('z', { ctrlKey: false })).toBeNull()
    expect(key('z', { defaultPrevented: true })).toBeNull()
  })

  it('leaves text fields to their native undo', () => {
    expect(key('z', { target: { tagName: 'TEXTAREA' } as unknown as EventTarget })).toBeNull()
    expect(key('z', { target: { tagName: 'INPUT', type: 'text' } as unknown as EventTarget })).toBeNull()
    expect(key('z', { target: { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget })).toBeNull()
    expect(key('z', { target: { tagName: 'INPUT', type: 'checkbox' } as unknown as EventTarget })).toBe('undo')
  })
})
