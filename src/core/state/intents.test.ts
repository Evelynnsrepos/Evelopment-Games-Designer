import { describe, expect, it } from 'vitest'
import { clearIntents, postIntent, takeIntents } from './intents'

describe('intents', () => {
  it('queues per component and empties on take', () => {
    clearIntents()
    postIntent('wiki', { action: 'a' })
    postIntent('wiki', { action: 'b' })
    postIntent('writer', { action: 'c' })
    expect(takeIntents('wiki').map((i) => i.action)).toEqual(['a', 'b'])
    expect(takeIntents('wiki')).toEqual([])
    expect(takeIntents('writer')).toHaveLength(1)
  })
})
