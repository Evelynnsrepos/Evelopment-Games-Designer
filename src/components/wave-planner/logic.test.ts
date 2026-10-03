import { describe, expect, it } from 'vitest'
import { createEntity, type Enemy, type Item } from '@/core/model'
import { computeWaves, createWaveDoc, newGroup, weaponReach, type WaveDoc } from './logic'

const goblin = (): Enemy => ({
  ...createEntity('enemy', 'Goblin'),
  stats: { HP: 100 },
  dropTable: [{ id: 'd', itemId: 'coin', amountMin: 1, amountMax: 3, chancePercent: 50 }],
})

const doc = (patch: Partial<WaveDoc> = {}): WaveDoc => ({ ...createWaveDoc(), waves: 5, timeBase: 10, timePerWave: 0, ...patch })

describe('wave planner', () => {
  it('grows counts and health per wave and works out the DPS needed', () => {
    const g = goblin()
    const rows = computeWaves(doc({ groups: [{ ...newGroup(g), countBase: 2, countPerWave: 1 }], healthGrowth: { mode: 'percent', perWave: 10 } }), [g])
    expect(rows.map((r) => r.enemies)).toEqual([2, 3, 4, 5, 6])
    expect(rows[1].groups[0].health).toBeCloseTo(110)
    expect(rows[0].dps).toBe(20) // 2 x 100 HP in 10 s
  })

  it('places bosses every few waves and custom enemies without the Enemy List', () => {
    const boss = { ...newGroup(), name: 'Boss', health: 1000, countBase: 1, countPerWave: 0, fromWave: 5, every: 5 }
    const rows = computeWaves(doc({ waves: 15, groups: [boss], healthGrowth: { mode: 'flat', perWave: 0 } }), [])
    expect(rows.filter((r) => r.enemies > 0).map((r) => r.wave)).toEqual([5, 10, 15])
  })

  it('scales drop chances per wave, capped at 100%', () => {
    const g = goblin()
    const rows = computeWaves(doc({ waves: 3, groups: [{ ...newGroup(g), countBase: 1, countPerWave: 0 }], dropGrowthPercent: 100 }), [g])
    // 50% x 2 average coins, then 100%, then capped at 100%
    expect(rows.map((r) => r.drops[0].amount)).toEqual([1, 2, 2])
  })

  it('tells how many waves each weapon clears', () => {
    const g = goblin()
    const rows = computeWaves(doc({ groups: [{ ...newGroup(g), countBase: 1, countPerWave: 1 }], healthGrowth: { mode: 'flat', perWave: 0 } }), [g])
    const sword: Item = { ...createEntity('item', 'Sword'), stats: { dps: 30 } }
    const stick: Item = { ...createEntity('item', 'Stick'), stats: {} }
    const reach = weaponReach(rows, [sword, stick], 'DPS')
    expect(reach[0].lastWave).toBe(3) // needs 10, 20, 30, 40… DPS
    expect(reach[1].dps).toBeUndefined()
  })
})
