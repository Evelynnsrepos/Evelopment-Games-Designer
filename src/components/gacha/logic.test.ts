import { describe, expect, it } from 'vitest'
import { createGachaDoc, lootChances, newLootEntry, simulateBanner, topChance } from './logic'

describe('gacha', () => {
  const b = createGachaDoc().banner

  it('soft and hard pity raise the top-tier chance', () => {
    expect(topChance(b, 1)).toBeCloseTo(0.006)
    expect(topChance(b, 75)).toBeCloseTo(0.006 + 0.12)
    expect(topChance(b, 90)).toBe(1)
  })

  it('a hard pity and a guarantee cap the pulls for one featured copy', () => {
    const r = simulateBanner(b, 3000)
    expect(r.pulls[r.pulls.length - 1]).toBeLessThanOrEqual(180)
    expect(r.average).toBeGreaterThan(60)
    expect(r.average).toBeLessThan(110)
    expect(r.doneBy(180)).toBe(1)
    expect(r.percentile(50)).toBeLessThanOrEqual(r.percentile(90))
  })

  it('without pity, a 1% always-featured top tier takes about 100 pulls on average', () => {
    const r = simulateBanner({ ...b, hardPity: null, softPityStart: null, featuredChance: 100, tiers: b.tiers.map((t) => (t.id === b.topTierId ? { ...t, rate: 1 } : t)) }, 20000)
    expect(r.average).toBeGreaterThan(90)
    expect(r.average).toBeLessThan(110)
  })

  it('works out loot chances', () => {
    const sword = { ...newLootEntry('Sword'), value: 1 }
    const coin = { ...newLootEntry('Coin'), value: 9, amountMin: 1, amountMax: 3 }
    const weighted = lootChances({ mode: 'weighted', entries: [sword, coin], targetId: sword.id, opens: 10 })
    expect(weighted.perOpen).toBeCloseTo(0.1)
    expect(weighted.opensFor(0.9)).toBe(22)
    expect(weighted.expected[1].amount).toBeCloseTo(1.8)
    const independent = lootChances({ mode: 'chance', entries: [{ ...sword, value: 50 }], targetId: sword.id, opens: 1 })
    expect(independent.opensFor(0.99)).toBe(7)
  })
})
