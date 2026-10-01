import { BookOpen, Network, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { newId, type Entity, type EntityType, type Id } from '@/core/model'
import { deleteDocument } from '@/core/project'
import type { PanelProps } from '@/core/registry'
import { flushDocument, useDocument, useIntentHandler, useProjectStore, type Intent } from '@/core/state'
import { openComponent } from '@/shell/editor/actions'
import { confirmDialog } from '@/shared/dialogs'
import { combineRefProviders, useEntityRefProvider, type RefProvider, type RefTarget } from '@/shared/richtext'
import {
  ARTICLE_KIND,
  articleRefProvider,
  articleTitle,
  emptyWikiIndex,
  WIKI_INDEX_ID,
  type WikiArticleMeta,
  type WikiIndex,
} from '@/shared/wiki'
import { Article } from './Article'
import { ConnectionMap } from './ConnectionMap'
import { addArticle, articleForEntity, backlinks, filterArticles, graphEdges, newArticleMeta, patchArticle, removeArticle, staleSourceTitles } from './model'
import { NewArticleDialog, type NewArticleChoice } from './NewArticleDialog'
import './wiki.css'

/**
 * Wiki (spec 8.2). Intents it understands (post with `postIntent('wiki', ...)`,
 * or use `openWikiArticle` / `openWikiArticleForEntity` from `@/shared/wiki`):
 *   { action: 'open-article', articleId }
 *   { action: 'article-for-entity', kind: EntityType, entityId }   opens it, creating it from the entity if needed
 */

const UI = {
  newArticle: 'New article',
  search: 'Search articles',
  articles: 'Articles',
  map: 'Connection map',
  noArticles: 'No articles yet.',
  noMatch: 'No article matches.',
  pickOne: 'Pick an article, or create one with New article.',
  loading: 'Loading…',
  createRef: (label: string) => `Create article "${label}"`,
  deleteTitle: 'Delete article?',
  deleteMessage: (title: string, mentions: number) =>
    `"${title}" will be deleted.` + (mentions ? ` ${mentions === 1 ? '1 article mentions' : `${mentions} articles mention`} it; those links will show as missing.` : ''),
  delete: 'Delete',
}

type Collections = Record<EntityType, Entity[]>

export default function View(_props: PanelProps) {
  const indexDoc = useDocument<WikiIndex>('wiki', WIKI_INDEX_ID, emptyWikiIndex)
  const index = indexDoc.data
  const entities = useProjectStore((s) => s.entities) as Collections
  const root = useProjectStore((s) => s.root)
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  const [mode, setMode] = useState<'article' | 'map'>('article')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState(false)

  const updateIndex = indexDoc.update
  const change = useCallback((recipe: (i: WikiIndex) => WikiIndex) => updateIndex(recipe, { undoable: false }), [updateIndex])

  const open = useCallback((id: Id) => {
    setSelectedId(id)
    setMode('article')
  }, [])

  const createArticle = useCallback(
    (title: string, source: WikiArticleMeta['source'] = null) => {
      const meta = newArticleMeta(newId(), title, source)
      change((i) => addArticle(i, meta))
      open(meta.id)
      return meta
    },
    [change, open],
  )

  /** WK-2: one article per entity; pulling again just opens the existing one. */
  const articleFromEntity = useCallback(
    (kind: EntityType, entityId: Id) => {
      if (!index) return
      const existing = articleForEntity(index, kind, entityId)
      if (existing) return open(existing.id)
      const entity = entities[kind]?.find((e) => e.id === entityId)
      if (entity) createArticle(entity.name, { kind, entityId })
    },
    [index, entities, open, createArticle],
  )

  useIntentHandler(
    'wiki',
    (intent: Intent) => {
      if (intent.action === 'open-article' && typeof intent.articleId === 'string') open(intent.articleId)
      if (intent.action === 'article-for-entity' && typeof intent.entityId === 'string') articleFromEntity(intent.kind as EntityType, intent.entityId)
    },
    !!index,
  )

  // WK-3: pulled articles follow the entity's name; keep the stored copy current for when the entity is deleted.
  useEffect(() => {
    if (!index) return
    const stale = staleSourceTitles(index, entities)
    if (stale.length) change((i) => stale.reduce((acc, s) => patchArticle(acc, s.id, { title: s.title }), i))
  }, [index, entities, change])

  // `[[` links: articles first (so `[[Ironhold]]` prefers the article), then entities.
  // Clicking an entity opens its article when it has one, otherwise its list.
  const entityRefs = useEntityRefProvider({
    open: useCallback(
      (t: RefTarget) => {
        const art = index && articleForEntity(index, t.kind as EntityType, t.id)
        if (art) open(art.id)
        else openComponent(`${t.kind}-list` as 'item-list')
      },
      [index, open],
    ),
  })
  const refs = useMemo<RefProvider>(() => {
    const articles: RefProvider = {
      ...articleRefProvider(index, entities, open),
      create: (label) => {
        const meta = createArticleRaw(label)
        return { kind: ARTICLE_KIND, id: meta.id, label }
      },
      createLabel: UI.createRef,
    }
    // Creating from the [[ menu must not navigate away from the article being written.
    function createArticleRaw(title: string) {
      const meta = newArticleMeta(newId(), title)
      change((i) => addArticle(i, meta))
      return meta
    }
    return combineRefProviders(articles, entityRefs)
  }, [index, entities, open, change, entityRefs])

  const titled = useMemo(() => (index?.articles ?? []).map((a) => ({ id: a.id, title: articleTitle(a, entities), meta: a })), [index, entities])
  const edges = useMemo(() => (index ? graphEdges(index) : []), [index])
  const mapNodes = useMemo(() => titled.map(({ id, title }) => ({ id, title })), [titled])

  if (!index) return <div className="wiki-empty">{UI.loading}</div>

  const visible = filterArticles(titled, query)
  const selected = titled.find((a) => a.id === selectedId)
  const mentions = selected ? backlinks(index, selected.id).map((a) => ({ id: a.id, title: articleTitle(a, entities) })) : []

  const onPick = (choice: NewArticleChoice) => {
    setDialog(false)
    if (choice.kind === 'blank') createArticle('')
    else articleFromEntity(choice.entityType, choice.entityId)
  }

  const onDelete = async () => {
    if (!selected || !root) return
    const ok = await confirmDialog({ title: UI.deleteTitle, message: UI.deleteMessage(selected.title, mentions.length), confirmLabel: UI.delete, danger: true })
    if (!ok) return
    const id = selected.id
    change((i) => removeArticle(i, id))
    setSelectedId(null)
    await flushDocument('wiki', id)
    await deleteDocument(root, 'wiki', id).catch(() => undefined)
  }

  return (
    <div className="wiki">
      <nav className="wiki-side" aria-label={UI.articles}>
        <div className="wiki-side-actions">
          <button className="btn btn-primary wiki-new-btn" onClick={() => setDialog(true)}>
            <Plus size={14} /> {UI.newArticle}
          </button>
          <button
            className={mode === 'map' ? 'icon-btn is-active' : 'icon-btn'}
            title={mode === 'map' ? UI.articles : UI.map}
            aria-label={UI.map}
            aria-pressed={mode === 'map'}
            onClick={() => setMode(mode === 'map' ? 'article' : 'map')}
          >
            {mode === 'map' ? <BookOpen size={16} /> : <Network size={16} />}
          </button>
        </div>
        <label className="wiki-search">
          <Search size={14} />
          <input className="input" value={query} placeholder={UI.search} aria-label={UI.search} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <ul className="wiki-list">
          {titled.length === 0 && <li className="wiki-muted">{UI.noArticles}</li>}
          {titled.length > 0 && visible.length === 0 && <li className="wiki-muted">{UI.noMatch}</li>}
          {visible.map((a) => (
            <li key={a.id}>
              <button className={a.id === selectedId ? 'wiki-list-item is-selected' : 'wiki-list-item'} onClick={() => open(a.id)}>
                {a.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="wiki-main">
        {mode === 'map' ? (
          <ConnectionMap nodes={mapNodes} edges={edges} selectedId={selectedId} onOpen={open} />
        ) : selected ? (
          <Article
            meta={selected.meta}
            title={selected.title}
            refs={refs}
            mentionedIn={mentions}
            onRename={(title) => change((i) => patchArticle(i, selected.id, { title, titleFromSource: false }))}
            onLinksChange={(links) => change((i) => patchArticle(i, selected.id, { links }))}
            onDelete={() => void onDelete()}
            onOpen={open}
          />
        ) : (
          <div className="wiki-empty">{UI.pickOne}</div>
        )}
      </main>
      {dialog && <NewArticleDialog index={index} onPick={onPick} onClose={() => setDialog(false)} />}
    </div>
  )
}
