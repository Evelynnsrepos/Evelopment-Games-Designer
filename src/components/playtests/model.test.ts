import { describe, expect, it } from 'vitest'
import { byBuild, newFinding, newSession, openFindings } from './model'

describe('playtests', () => {
  it('averages scores per build and sorts open findings by severity', () => {
    const a = { ...newSession(), date: '2026-10-01', build: '0.1', fun: 4, findings: [{ ...newFinding(), text: 'Typo', severity: 'minor' as const, area: 'Menu' }] }
    const b = { ...newSession(), date: '2026-10-02', build: '0.1', fun: 6, findings: [{ ...newFinding(), text: 'Crash', severity: 'blocker' as const, area: 'Menu' }, { ...newFinding(), text: 'Old', fixed: true }] }
    const c = { ...newSession(), date: '2026-10-05', build: '0.2', fun: 8 }
    expect(byBuild([c, a, b]).map((x) => [x.build, x.sessions, x.fun])).toEqual([
      ['0.1', 2, 5],
      ['0.2', 1, 8],
    ])
    const o = openFindings([a, b, c])
    expect(o.list.map((f) => f.text)).toEqual(['Crash', 'Typo'])
    expect(o.areas).toEqual([['Menu', 2]])
  })
})
