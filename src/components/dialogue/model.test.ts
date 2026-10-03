import { describe, expect, it } from 'vitest'
import { exportInk, exportJson, exportYarn, newChoice, newLine, unreachable, type DialogueDoc } from './model'

const flags = [{ id: 'f', name: 'met_king', kind: 'bool' as const, initial: 0, note: '' }]

function sample(): DialogueDoc {
  const a = { ...newLine(), speakerName: 'King', text: 'Who goes there?' }
  const b = { ...newLine(), speakerName: 'Player', text: 'A friend.' }
  const c = { ...newLine(), speakerName: 'King', text: 'Begone!' }
  const lost = { ...newLine(), text: 'Never said' }
  a.choices = [
    { ...newChoice(), text: 'Friend', to: b.id, changes: [{ flagId: 'f', op: 'set', value: 1 }] },
    { ...newChoice(), text: 'Nobody', to: c.id, conditions: [{ flagId: 'f', op: '==', value: 0 }] },
  ]
  return { startId: a.id, lines: [a, b, c, lost] }
}

const speaker = (l: { speakerName: string }) => l.speakerName

describe('dialogue', () => {
  it('finds lines nothing leads to', () => {
    const d = sample()
    expect([...unreachable(d)]).toEqual([d.lines[3].id])
  })

  it('exports JSON with line names and flag names', () => {
    const json = JSON.parse(exportJson(sample(), flags, speaker))
    expect(json.start).toBe('n1')
    expect(json.lines.n1.choices[0]).toMatchObject({ text: 'Friend', to: 'n2', changes: [{ flag: 'met_king', op: 'set', value: 1 }] })
  })

  it('exports Yarn and Ink', () => {
    const yarn = exportYarn(sample(), flags, speaker)
    expect(yarn).toContain('title: n1')
    expect(yarn).toContain('-> Nobody <<if not $met_king>>')
    expect(yarn).toContain('<<set $met_king = true>>')
    const ink = exportInk(sample(), flags, speaker)
    expect(ink).toContain('VAR met_king = false')
    expect(ink).toContain('* {not met_king} [Nobody]')
    expect(ink).toContain('-> n1')
  })
})
