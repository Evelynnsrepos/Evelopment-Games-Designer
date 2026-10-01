import { describe, expect, it } from 'vitest'
import type { Entity, EntityType } from '@/core/model'
import { emptyWikiIndex, type WikiIndex } from '@/shared/wiki'
import { layoutGraph } from './graph'
import { addArticle, articleForEntity, backlinks, filterArticles, graphEdges, newArticleMeta, patchArticle, staleSourceTitles } from './model'

function build(): WikiIndex {
  let index = emptyWikiIndex()
  index = addArticle(index, newArticleMeta('aria', 'Aria', { kind: 'character', entityId: 'c-aria' }))
  index = addArticle(index, newArticleMeta('iron', 'Ironhold', { kind: 'town', entityId: 't-iron' }))
  index = addArticle(index, newArticleMeta('war', 'The War'))
  // Aria links to the Ironhold town entity, The War links to both articles directly.
  index = patchArticle(index, 'aria', { links: [{ kind: 'town', targetId: 't-iron' }] })
  index = patchArticle(index, 'war', {
    links: [
      { kind: 'article', targetId: 'aria' },
      { kind: 'article', targetId: 'iron' },
      { kind: 'article', targetId: 'war' },
    ],
  })
  return index
}

describe('wiki index', () => {
  it('finds the article pulled from an entity', () => {
    expect(articleForEntity(build(), 'character', 'c-aria')?.id).toBe('aria')
    expect(articleForEntity(build(), 'character', 'nope')).toBeUndefined()
  })

  it('counts links to an entity as mentions of its article (AC: [[Ironhold]])', () => {
    const index = build()
    expect(backlinks(index, 'iron').map((a) => a.id).sort()).toEqual(['aria', 'war'])
    expect(backlinks(index, 'war')).toEqual([])
  })

  it('makes one undirected edge per connected pair and ignores self links', () => {
    const edges = graphEdges(build()).map((e) => [...e].sort().join('-')).sort()
    expect(edges).toEqual(['aria-iron', 'aria-war', 'iron-war'])
  })

  it('keeps pulled titles in step with entity names', () => {
    const entities = { item: [], character: [{ id: 'c-aria', name: 'Aria Vale' }], town: [{ id: 't-iron', name: 'Ironhold' }], enemy: [] }
    expect(staleSourceTitles(build(), entities as unknown as Record<EntityType, Entity[]>)).toEqual([{ id: 'aria', title: 'Aria Vale' }])
  })

  it('searches titles case-insensitively, alphabetically', () => {
    expect(filterArticles(build().articles, 'IRON').map((a) => a.id)).toEqual(['iron'])
    expect(filterArticles(build().articles, '').map((a) => a.title)).toEqual(['Aria', 'Ironhold', 'The War'])
  })
})

describe('layoutGraph', () => {
  it('places every node, deterministically, with linked nodes closer than unlinked ones', () => {
    const ids = ['a', 'b', 'c', 'd']
    const edges: [string, string][] = [['a', 'b']]
    const one = layoutGraph(ids, edges)
    const two = layoutGraph(ids, edges)
    expect([...one.keys()]).toEqual(ids)
    expect(one.get('c')).toEqual(two.get('c'))
    const dist = (p: string, q: string) => Math.hypot(one.get(p)!.x - one.get(q)!.x, one.get(p)!.y - one.get(q)!.y)
    expect(dist('a', 'b')).toBeLessThan(dist('c', 'd'))
  })
})
