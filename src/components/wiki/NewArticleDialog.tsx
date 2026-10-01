import { FilePlus2, Search } from 'lucide-react'
import { useState } from 'react'
import { ENTITY_TYPES, type Entity, type EntityType, type Id } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { ENTITY_LABELS } from '@/shared/categories'
import { Modal } from '@/shared/ui'
import type { WikiIndex } from '@/shared/wiki'
import { articleForEntity } from './model'

const UI = {
  title: 'New article',
  blank: 'Blank article',
  blankHint: 'Start from an empty page',
  pull: 'Or pull from a list',
  search: (many: string) => `Search ${many.toLowerCase()}`,
  none: (many: string) => `No ${many.toLowerCase()} yet. Add some in their list first.`,
  noMatch: 'Nothing matches.',
  hasArticle: 'has an article',
  cancel: 'Cancel',
}

export type NewArticleChoice = { kind: 'blank' } | { kind: 'entity'; entityType: EntityType; entityId: Id }

/** WK-2: New Article offers a blank page or pulling from the Item, Character, Town or Enemy List. */
export function NewArticleDialog({ index, onPick, onClose }: { index: WikiIndex; onPick: (choice: NewArticleChoice) => void; onClose: () => void }) {
  const entities = useProjectStore((s) => s.entities)
  const [tab, setTab] = useState<EntityType>('character')
  const [query, setQuery] = useState('')

  const list = (entities[tab] as Entity[])
    .filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const total = (entities[tab] as Entity[]).length

  return (
    <Modal onClose={onClose}>
      <div className="wiki-new">
        <h3>{UI.title}</h3>
        <button className="wiki-new-blank" onClick={() => onPick({ kind: 'blank' })} autoFocus>
          <FilePlus2 size={18} />
          <span>
            <strong>{UI.blank}</strong>
            <small>{UI.blankHint}</small>
          </span>
        </button>
        <div className="wiki-new-label">{UI.pull}</div>
        <div className="wiki-new-tabs" role="tablist">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === tab}
              className={t === tab ? 'wiki-new-tab is-active' : 'wiki-new-tab'}
              onClick={() => setTab(t)}
            >
              {ENTITY_LABELS[t].many} <span className="wiki-count">{(entities[t] as Entity[]).length}</span>
            </button>
          ))}
        </div>
        <label className="wiki-search">
          <Search size={14} />
          <input className="input" value={query} placeholder={UI.search(ENTITY_LABELS[tab].many)} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="wiki-new-list">
          {total === 0 && <div className="wiki-muted">{UI.none(ENTITY_LABELS[tab].many)}</div>}
          {total > 0 && list.length === 0 && <div className="wiki-muted">{UI.noMatch}</div>}
          {list.map((e) => (
            <button key={e.id} className="wiki-new-entity" onClick={() => onPick({ kind: 'entity', entityType: tab, entityId: e.id })}>
              <span>{e.name || 'Untitled'}</span>
              {articleForEntity(index, tab, e.id) && <small className="wiki-muted">{UI.hasArticle}</small>}
            </button>
          ))}
        </div>
        <div className="wiki-new-actions">
          <button className="btn" onClick={onClose}>
            {UI.cancel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
