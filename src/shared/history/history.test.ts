import { describe, expect, it } from 'vitest'
import { createEntity } from '@/core/model'
import { addSnapshot, createHistoryDoc, diff, MERGE_MS } from './history'

describe('entry history', () => {
  const sword = { ...createEntity('item'), name: 'Sword', stats: { ATK: 5 } }

  it('keeps the old state, merges quick edits and starts a new version later', () => {
    const t0 = new Date('2026-10-04T10:00:00Z')
    let h = addSnapshot(createHistoryDoc(), { ...sword, name: 'Sword+' }, t0, sword)
    expect(h.entries[sword.id].map((s) => s.data.name)).toEqual(['Sword', 'Sword+'])
    h = addSnapshot(h, { ...sword, name: 'Sword++' }, new Date(t0.getTime() + 1000))
    expect(h.entries[sword.id].map((s) => s.data.name)).toEqual(['Sword', 'Sword++'])
    h = addSnapshot(h, { ...sword, name: 'Great Sword' }, new Date(t0.getTime() + MERGE_MS + 5000))
    expect(h.entries[sword.id].map((s) => s.data.name)).toEqual(['Sword', 'Sword++', 'Great Sword'])
  })

  it('lists what changed', () => {
    const changes = diff(sword, { ...sword, name: 'Axe', stats: { ATK: 7, SPD: 2 } })
    expect(changes).toEqual([
      { field: 'name', before: 'Sword', after: 'Axe' },
      { field: 'ATK', before: '5', after: '7' },
      { field: 'SPD', before: '—', after: '2' },
    ])
  })
})
