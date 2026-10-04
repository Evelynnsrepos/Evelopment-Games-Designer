import { describe, expect, it } from 'vitest'
import { createPacingDoc, newBeat, pacingNotes } from './model'

describe('pacing', () => {
  it('spots flat stretches and peaks without rest', () => {
    const d = createPacingDoc()
    const c = d.curves[0]
    expect(pacingNotes(d.beats, c)).toEqual(['"The ambush" and "First boss" are both very high intensity with no breather between.'])
    const flat = [0, 10, 20].map((at) => ({ ...newBeat(at, d.curves), name: `b${at}` }))
    expect(pacingNotes(flat, c)[0]).toMatch(/stays flat from "b0" to "b20"/)
  })
})
