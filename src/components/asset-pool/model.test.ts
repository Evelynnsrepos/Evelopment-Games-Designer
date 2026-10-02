import { describe, expect, it } from 'vitest'
import { createPool, newEntry, nextStatus, parseChecklist, progress, trackedIds } from './model'

describe('asset pool', () => {
  it('reads checklists with bullets, numbers and checkboxes', () => {
    expect(parseChecklist('- [ ] Sword icon\n* Shield\n\n1. Boss music\n- [x] Logo\nPlain line')).toEqual(['Sword icon', 'Shield', 'Boss music', 'Logo', 'Plain line'])
  })

  it('knows which entities are already tracked per kind', () => {
    const pool = createPool()
    pool.entries.push(newEntry('Sword', 'Icon', { type: 'item', id: 'a' }))
    expect(trackedIds(pool, 'item', 'Icon')).toEqual(new Set(['a']))
    expect(trackedIds(pool, 'item', '3D model').size).toBe(0)
  })

  it('cycles status and counts progress', () => {
    expect(nextStatus('done')).toBe('needed')
    const done = { ...newEntry('x', 'Other'), status: 'done' as const }
    expect(progress([done, newEntry('y', 'Other')])).toEqual({ done: 1, total: 2 })
  })
})
