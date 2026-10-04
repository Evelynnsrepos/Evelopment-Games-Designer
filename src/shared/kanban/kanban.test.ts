import { describe, expect, it } from 'vitest'
import { moveCard } from './move'

describe('kanban', () => {
  it('moves a card into a column before another card or to the end', () => {
    const list = [
      { id: 'a', col: 'x' },
      { id: 'b', col: 'x' },
      { id: 'c', col: 'y' },
    ]
    expect(moveCard(list, 'a', 'c', (c) => ({ ...c, col: 'y' }))).toEqual([{ id: 'b', col: 'x' }, { id: 'a', col: 'y' }, { id: 'c', col: 'y' }])
    expect(moveCard(list, 'a', null, (c) => ({ ...c, col: 'z' })).map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })
})
