import { describe, expect, it } from 'vitest'
import { newAchievement, summary } from './model'

describe('achievements', () => {
  it('sums points and counts hidden, rare and common ones', () => {
    const list = [
      { ...newAchievement(), points: 50, expectedPercent: 5, hidden: true },
      { ...newAchievement(), points: 10, expectedPercent: 80 },
    ]
    expect(summary(list)).toEqual({ count: 2, points: 60, hidden: 1, rare: 1, common: 1 })
  })
})
