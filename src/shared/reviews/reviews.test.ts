import { describe, expect, it } from 'vitest'
import { needsReview, openComments, reviewKey, type ReviewEntry } from './reviews'

describe('reviews', () => {
  it('keys entities and documents, single-document tools by type', () => {
    expect(reviewKey({ kind: 'entity', type: 'item', id: 'a' })).toBe('entity:item:a')
    expect(reviewKey({ kind: 'doc', type: 'quests', id: null })).toBe('doc:quests:quests')
  })

  it('needs review when waiting for review or a comment is open', () => {
    const c = { id: '1', author: 'A', color: '#000', text: 'Hm', at: '', resolved: false }
    const e: ReviewEntry = { target: { kind: 'doc', type: 'wiki', id: 'w' }, status: 'draft', comments: [c], updatedAt: '' }
    expect(openComments(e)).toBe(1)
    expect(needsReview(e)).toBe(true)
    expect(needsReview({ ...e, comments: [{ ...c, resolved: true }] })).toBe(false)
    expect(needsReview({ ...e, status: 'review', comments: [] })).toBe(true)
  })
})
