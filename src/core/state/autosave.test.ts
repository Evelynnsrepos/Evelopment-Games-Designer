import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushAll, hasPendingSaves, scheduleSave } from './autosave'
import { History } from './history'

describe('autosave', () => {
  afterEach(() => vi.useRealTimers())

  it('debounces repeated saves of the same key', async () => {
    vi.useFakeTimers()
    const run = vi.fn(async () => {})
    scheduleSave('a', run)
    scheduleSave('a', run)
    await vi.advanceTimersByTimeAsync(999)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('flushAll writes immediately', async () => {
    const run = vi.fn(async () => {})
    scheduleSave('root|x', run)
    await flushAll('root|')
    expect(run).toHaveBeenCalledTimes(1)
    expect(hasPendingSaves()).toBe(false)
  })

  it('never writes the same key twice at once, and flushAll waits for writes already running', async () => {
    const order: string[] = []
    let active = 0
    const slow = (name: string) => async () => {
      active++
      expect(active).toBe(1)
      await new Promise((r) => setTimeout(r, 20))
      order.push(name)
      active--
    }
    scheduleSave('root|meta', slow('old'), 0)
    await new Promise((r) => setTimeout(r, 5)) // the timer has started the old write
    scheduleSave('root|meta', slow('new'))
    await flushAll('root|')
    expect(order).toEqual(['old', 'new'])
  })
})

describe('History', () => {
  it('undoes and redoes', () => {
    const h = new History<number>()
    h.record(1)
    h.record(2)
    expect(h.undo(3)).toBe(2)
    expect(h.undo(2)).toBe(1)
    expect(h.redo(1)).toBe(2)
    h.record(2)
    expect(h.canRedo).toBe(false)
  })
})
