import { describe, expect, it } from 'vitest'
import { createCombatDoc, newFighter, simulateCombat } from './model'

describe('combat simulator', () => {
  it('a much stronger side always wins', () => {
    const d = { ...createCombatDoc(), runs: 200, teams: [[{ ...newFighter('Knight'), hp: 500, atk: 80 }], [{ ...newFighter('Rat'), hp: 20, atk: 5 }]] as [ReturnType<typeof newFighter>[], ReturnType<typeof newFighter>[]] }
    const r = simulateCombat(d)
    expect(r.wins[0]).toBe(200)
    expect(r.avgHpLeft[0]).toBeGreaterThan(0.9)
    expect(r.log.length).toBeGreaterThan(0)
  })

  it('mirror fights are roughly even and counts add fighters', () => {
    const f = newFighter('Duelist')
    const r = simulateCombat({ ...createCombatDoc(), runs: 2000, teams: [[f], [{ ...f, id: 'b' }]] })
    expect(r.wins[0] / 2000).toBeGreaterThan(0.4)
    expect(r.wins[0] / 2000).toBeLessThan(0.6)
    const swarm = simulateCombat({ ...createCombatDoc(), runs: 200, teams: [[f], [{ ...f, id: 'c', count: 5 }]] })
    expect(swarm.wins[1]).toBeGreaterThan(190)
    expect(simulateCombat({ ...createCombatDoc(), formulaId: 'nope' }).error).toBeTruthy()
  })
})
