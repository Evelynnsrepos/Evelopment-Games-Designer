import type { Entity, EntityType, Id } from '@/core/model'
import type { RefTarget } from '@/shared/richtext'
import { ARTICLE_KIND, type WikiArticleMeta, type WikiIndex, type WikiLink } from '@/shared/wiki'

/** Pure operations on the wiki index (spec 8.2). The View wires them to `useDocument('wiki', 'index')`. */

type Collections = Record<EntityType, Entity[]>

export function newArticleMeta(id: Id, title: string, source: WikiArticleMeta['source'] = null): WikiArticleMeta {
  const t = new Date().toISOString()
  return { id, title, source, titleFromSource: !!source, links: [], createdAt: t, updatedAt: t }
}

export function addArticle(index: WikiIndex, meta: WikiArticleMeta): WikiIndex {
  return { ...index, articles: [...index.articles, meta] }
}

export function removeArticle(index: WikiIndex, id: Id): WikiIndex {
  return { ...index, articles: index.articles.filter((a) => a.id !== id) }
}

export function patchArticle(index: WikiIndex, id: Id, patch: Partial<WikiArticleMeta>): WikiIndex {
  let changed = false
  const articles = index.articles.map((a) => {
    if (a.id !== id) return a
    changed = true
    return { ...a, ...patch, updatedAt: new Date().toISOString() }
  })
  return changed ? { ...index, articles } : index
}

export const toWikiLinks = (refs: RefTarget[]): WikiLink[] => refs.map((r) => ({ kind: r.kind, targetId: r.id }))

export function sameLinks(a: WikiLink[], b: WikiLink[]): boolean {
  return a.length === b.length && a.every((l, i) => l.kind === b[i].kind && l.targetId === b[i].targetId)
}

/** The article pulled from this entity, if any. */
export function articleForEntity(index: WikiIndex, kind: EntityType, entityId: Id): WikiArticleMeta | undefined {
  return index.articles.find((a) => a.source?.kind === kind && a.source.entityId === entityId)
}

/**
 * The article a link lands on: an article link directly, an entity link via the
 * article pulled from that entity (so `[[Ironhold]]` the town still connects to
 * the Ironhold article). Undefined when there is no such article.
 */
export function linkedArticleId(index: WikiIndex, link: WikiLink): Id | undefined {
  if (link.kind === ARTICLE_KIND) return index.articles.some((a) => a.id === link.targetId) ? link.targetId : undefined
  return index.articles.find((a) => a.source?.kind === link.kind && a.source.entityId === link.targetId)?.id
}

/** Articles each article mentions, without itself, each once. */
export function outgoing(index: WikiIndex): Map<Id, Id[]> {
  const out = new Map<Id, Id[]>()
  for (const a of index.articles) {
    const targets = new Set<Id>()
    for (const link of a.links) {
      const to = linkedArticleId(index, link)
      if (to && to !== a.id) targets.add(to)
    }
    out.set(a.id, [...targets])
  }
  return out
}

/** "Mentioned in" (WK-7): articles that link to this article or to the entity it was pulled from. */
export function backlinks(index: WikiIndex, articleId: Id): WikiArticleMeta[] {
  const out = outgoing(index)
  return index.articles.filter((a) => a.id !== articleId && out.get(a.id)!.includes(articleId))
}

/** Undirected edges for the connection map (WK-5), each pair once. */
export function graphEdges(index: WikiIndex): [Id, Id][] {
  const seen = new Set<string>()
  const edges: [Id, Id][] = []
  for (const [from, targets] of outgoing(index)) {
    for (const to of targets) {
      const key = from < to ? `${from}|${to}` : `${to}|${from}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push([from, to])
    }
  }
  return edges
}

/**
 * Pulled articles whose stored title no longer matches the entity's name.
 * The stored title is kept in step so the name survives if the entity is deleted.
 */
export function staleSourceTitles(index: WikiIndex, entities: Collections): { id: Id; title: string }[] {
  const out: { id: Id; title: string }[] = []
  for (const a of index.articles) {
    if (!a.titleFromSource || !a.source) continue
    const entity = (entities[a.source.kind] ?? []).find((e) => e.id === a.source!.entityId)
    if (entity && entity.name.trim() && entity.name !== a.title) out.push({ id: a.id, title: entity.name })
  }
  return out
}

/** Case-insensitive search over titles. */
export function filterArticles<T extends { title: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title))
  return q ? sorted.filter((a) => a.title.toLowerCase().includes(q)) : sorted
}
