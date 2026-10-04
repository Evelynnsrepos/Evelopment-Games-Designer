import { describe, expect, it } from 'vitest'
import { createPrinciplesDoc, missingBuiltIns, movePrinciple, restoreBuiltIns, visiblePrinciples } from './model'
import { SEED } from './seed'

describe('writing principles', () => {
  it('starts with every built-in entry and restores deleted ones only', () => {
    const doc = createPrinciplesDoc()
    expect(doc.categories).toHaveLength(SEED.length)
    expect(doc.principles).toHaveLength(SEED.reduce((n, c) => n + c.items.length, 0))
    const edited = { ...doc, principles: doc.principles.slice(1).map((p, i) => (i === 0 ? { ...p, title: 'Mine' } : p)) }
    expect(missingBuiltIns(edited)).toBe(1)
    const back = restoreBuiltIns(edited)
    expect(back.principles).toHaveLength(doc.principles.length)
    expect(back.principles.some((p) => p.title === 'Mine')).toBe(true)
    expect(back.categories).toHaveLength(doc.categories.length)
    expect(back.principles[0].seed).toBe(doc.principles[0].seed)
  })

  it('filters, sorts and moves within a category', () => {
    const doc = createPrinciplesDoc()
    const story = doc.categories[0].id
    expect(visiblePrinciples(doc, null, 'chekhov').map((p) => p.title)).toEqual(['Setup and payoff'])
    const az = visiblePrinciples({ ...doc, sort: 'az' }, story, '')
    expect(az[0].title.localeCompare(az[1].title)).toBeLessThanOrEqual(0)
    const first = visiblePrinciples(doc, story, '')[0]
    const moved = movePrinciple(doc, first.id, 1)
    expect(visiblePrinciples(moved, story, '')[1].id).toBe(first.id)
    expect(movePrinciple(doc, first.id, -1)).toBe(doc)
  })
})
