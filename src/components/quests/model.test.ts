import { describe, expect, it } from 'vitest'
import { newQuest, questPath, totalRewards, wouldLoop } from './model'

describe('quests', () => {
  const a = { ...newQuest('A'), rewardXp: 10, rewardItems: [{ itemId: 'coin', amount: 2 }] }
  const b = { ...newQuest('B'), requires: [a.id], rewardXp: 5, rewardGold: 3, rewardItems: [{ itemId: 'coin', amount: 1 }] }
  const c = { ...newQuest('C'), requires: [b.id] }
  const all = [a, b, c]

  it('refuses requirements that would make a loop', () => {
    expect(wouldLoop(all, a.id, c.id)).toBe(true)
    expect(wouldLoop(all, c.id, a.id)).toBe(false)
    expect(wouldLoop(all, a.id, a.id)).toBe(true)
  })

  it('lists the quests needed first, in order', () => {
    expect(questPath(all, c.id).map((q) => q.name)).toEqual(['A', 'B'])
  })

  it('adds up rewards', () => {
    const t = totalRewards(all)
    expect([t.xp, t.gold, t.items.get('coin')]).toEqual([15, 3, 3])
  })
})
