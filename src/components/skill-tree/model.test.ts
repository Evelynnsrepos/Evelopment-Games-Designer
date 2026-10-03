import { describe, expect, it } from 'vitest'
import { cannotAdd, cannotRemove, createSkillTreeDoc, newSkill, spent, wouldLoop, type SkillTreeDoc } from './model'

function tree(): SkillTreeDoc {
  const a = { ...newSkill('Slash'), maxRank: 3 }
  const b = { ...newSkill('Whirlwind'), requires: [a.id], cost: 2 }
  const c = { ...newSkill('Rage'), pointsNeeded: 3 }
  return { ...createSkillTreeDoc(), skills: [a, b, c], budget: { start: 0, perLevel: 1, level: 6 } }
}

describe('skill tree', () => {
  it('needs required skills, points spent and enough points', () => {
    const d = tree()
    const [a, b, c] = d.skills
    expect(cannotAdd(d, b.id)).toMatch(/Slash/)
    expect(cannotAdd(d, c.id)).toMatch(/3 points/)
    const withA = { ...d, plan: { [a.id]: 3 } }
    expect(cannotAdd(withA, a.id)).toMatch(/max rank/)
    expect(cannotAdd(withA, b.id)).toBeNull()
    expect(cannotAdd(withA, c.id)).toBeNull()
    const full = { ...withA, plan: { ...withA.plan, [b.id]: 1, [c.id]: 1 } }
    expect(spent(full)).toBe(6)
    expect(cannotAdd({ ...full, skills: [...full.skills, newSkill('X')] }, 'nope')).toBe('Unknown skill')
  })

  it('cannot take back what others build on', () => {
    const d = tree()
    const [a, b, c] = d.skills
    const p = { ...d, plan: { [a.id]: 3, [b.id]: 1, [c.id]: 1 } }
    expect(cannotRemove({ ...p, plan: { [a.id]: 3, [c.id]: 1 } }, a.id)).toMatch(/Rage needs 3/)
    expect(cannotRemove({ ...p, plan: { [a.id]: 1, [b.id]: 1 } }, a.id)).toMatch(/Whirlwind/)
    expect(cannotRemove(p, b.id)).toBeNull()
  })

  it('spots loops', () => {
    const [a, b] = tree().skills
    expect(wouldLoop([a, b], a.id, b.id)).toBe(true)
    expect(wouldLoop([a, b], b.id, a.id)).toBe(false)
  })
})
