import { useMemo } from 'react'
import type { Entity, EntityType, Id } from '@/core/model'
import { postIntent, useDocument, useProjectStore } from '@/core/state'
import { openComponent } from '@/shell/editor/actions'
import { rankRefItems } from '../richtext/refs'
import type { RefItem, RefProvider, RefTarget } from '../richtext/types'

/**
 * The Wiki's article list (spec 8.2), shared so other tools can link to and
 * open articles (Writer 8.6, Timeline TL-9, Story SW-2) without importing the
 * Wiki component. Only the Wiki writes the index; everyone else reads it.
 *
 * Storage: `components/wiki/index.json` holds `WikiIndex`; each article body is
 * `components/wiki/<articleId>.json` holding `WikiArticleDoc`.
 */
export const WIKI_INDEX_ID = 'index'

/** `kind` of a `[[` link that points at a wiki article. */
export const ARTICLE_KIND = 'article'

/** A `[[` link stored in the index; `targetId` (not `id`) so "where is this used?" finds it. */
export interface WikiLink {
  kind: string
  targetId: Id
}

export interface WikiArticleMeta {
  id: Id
  title: string
  /** The entity this article was pulled from (WK-2, WK-3), shown in its info box. */
  source: { kind: EntityType; entityId: Id } | null
  /** While true the title follows the entity's name (renames show up in the wiki). */
  titleFromSource: boolean
  /** Outgoing `[[` links, cached from the body for backlinks and the connection map (WK-5, WK-7). */
  links: WikiLink[]
  createdAt: string
  updatedAt: string
}

export interface WikiIndex {
  articles: WikiArticleMeta[]
}

export interface WikiArticleDoc {
  body: unknown
}

export const emptyWikiIndex = (): WikiIndex => ({ articles: [] })

export const UNTITLED_ARTICLE = 'Untitled article'

type Collections = Record<EntityType, Entity[]>

export function findSourceEntity(meta: WikiArticleMeta, entities: Collections): Entity | undefined {
  if (!meta.source) return undefined
  return (entities[meta.source.kind] ?? []).find((e) => e.id === meta.source!.entityId)
}

/** The title to show: the entity's current name for pulled articles, else the article's own title. */
export function articleTitle(meta: WikiArticleMeta, entities: Collections): string {
  if (meta.titleFromSource) {
    const entity = findSourceEntity(meta, entities)
    if (entity?.name.trim()) return entity.name
  }
  return meta.title.trim() || UNTITLED_ARTICLE
}

/** Read-only view of the wiki index for other tools; undefined while loading. */
export function useWikiIndex(): WikiIndex | undefined {
  return useDocument<WikiIndex>('wiki', WIKI_INDEX_ID, emptyWikiIndex).data
}

/** Open the Wiki at an article. */
export function openWikiArticle(articleId: Id) {
  openComponent('wiki')
  postIntent('wiki', { action: 'open-article', articleId })
}

/** Open the Wiki at the article for an entity, creating it from the entity if there is none (WK-2, CH-6, EN-7). */
export function openWikiArticleForEntity(kind: EntityType, entityId: Id) {
  openComponent('wiki')
  postIntent('wiki', { action: 'article-for-entity', kind, entityId })
}

/** `[[` targets for wiki articles, given the index. Pure, so the Wiki can extend it. */
export function articleRefProvider(index: WikiIndex | undefined, entities: Collections, open: (articleId: Id) => void = openWikiArticle): RefProvider {
  const articles = index?.articles ?? []
  const toItem = (a: WikiArticleMeta): RefItem => ({ kind: ARTICLE_KIND, id: a.id, label: articleTitle(a, entities), hint: 'Article' })
  return {
    search: (query) => rankRefItems(articles.map(toItem), query),
    resolve: (target: RefTarget) => {
      if (target.kind !== ARTICLE_KIND) return undefined
      const hit = articles.find((a) => a.id === target.id)
      return hit && toItem(hit)
    },
    open: (target) => target.kind === ARTICLE_KIND && open(target.id),
  }
}

/** `[[` links to wiki articles for tools other than the Wiki; clicking one opens the Wiki. */
export function useArticleRefProvider(): RefProvider {
  const index = useWikiIndex()
  const entities = useProjectStore((s) => s.entities) as Collections
  return useMemo(() => articleRefProvider(index, entities), [index, entities])
}
