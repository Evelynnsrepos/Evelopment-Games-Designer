import { ExternalLink, MessageSquare } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Entity } from '@/core/model'
import { getManifest, type PanelProps } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import { openEntity } from '@/shared/entityList/navigation'
import { needsReview, openComments, reviewKey, ReviewThread, STATUS_COLOR, STATUS_LABEL, STATUSES, useReviews, type ReviewEntry, type ReviewTarget } from '@/shared/reviews'
import { openComponent } from '@/shell/editor/actions'
import './reviews.css'

const TYPE_LABEL = { item: 'Item', character: 'Character', town: 'Town', enemy: 'Enemy' } as const

/** Display name of a review target; null when it was deleted. */
function useLabel() {
  const entities = useProjectStore((s) => s.entities)
  const documents = useProjectStore((s) => s.meta?.documents ?? [])
  return (t: ReviewTarget): { name: string; kind: string } | null => {
    if (t.kind === 'entity') {
      const e = (entities[t.type] as Entity[]).find((x) => x.id === t.id)
      return e ? { name: e.name || 'Untitled', kind: TYPE_LABEL[t.type] } : null
    }
    const tool = getManifest(t.type)?.name ?? t.type
    const docId = t.kind === 'pin' ? t.doc : t.id
    const d = docId === null ? null : documents.find((x) => x.id === docId)
    if (docId !== null && !d) return null
    const name = d ? d.title : tool
    return t.kind === 'pin' ? { name: `Comment on ${name}`, kind: tool } : { name, kind: d ? tool : 'Tool' }
  }
}

const open = (t: ReviewTarget) => (t.kind === 'entity' ? openEntity(t.type, t.id) : openComponent(t.type, t.kind === 'pin' ? t.doc : t.id))

/** Reviews (v0.7): everything with a status or comments, as a board from Idea to Final. */
export default function ReviewsView(_props: PanelProps) {
  const { entries } = useReviews()
  const label = useLabel()
  const [onlyNeeds, setOnlyNeeds] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.entries(entries)
      .map(([key, e]) => ({ key, e, l: label(e.target) }))
      .filter((r) => (!onlyNeeds || needsReview(r.e)) && (!q || (r.l?.name ?? '').toLowerCase().includes(q)))
      .sort((a, b) => b.e.updatedAt.localeCompare(a.e.updatedAt))
  }, [entries, label, onlyNeeds, query])

  const columns: { id: string; title: string; color: string; rows: typeof rows }[] = [
    { id: 'none', title: 'No status', color: 'var(--border)', rows: rows.filter((r) => !r.e.status) },
    ...STATUSES.map((s) => ({ id: s, title: STATUS_LABEL[s], color: STATUS_COLOR[s], rows: rows.filter((r) => r.e.status === s) })),
  ].filter((c) => c.id !== 'none' || c.rows.length > 0)

  const sel = selected ? entries[selected] : undefined
  const needCount = Object.values(entries).filter(needsReview).length

  return (
    <div className="reviews">
      <div className="reviews-toolbar">
        <input className="input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="reviews-check">
          <input type="checkbox" checked={onlyNeeds} onChange={(e) => setOnlyNeeds(e.target.checked)} />
          Needs review only ({needCount})
        </label>
      </div>
      {Object.keys(entries).length === 0 ? (
        <p className="reviews-empty">
          Nothing to review yet. Every tool window and every item, character, town and enemy has a small "Review" button: give it a status (Idea, Draft, In
          review, Approved, Final) or leave a comment, and it shows up here.
        </p>
      ) : (
        <div className="reviews-main">
          <div className="reviews-board">
            {columns.map((c) => (
              <section key={c.id} className="reviews-col">
                <h4 style={{ borderColor: c.color }}>
                  {c.title} <span>{c.rows.length}</span>
                </h4>
                {c.rows.map((r) => (
                  <Card key={r.key} entry={r.e} name={r.l?.name ?? 'Deleted'} kind={r.l?.kind ?? ''} active={selected === r.key} onClick={() => setSelected(r.key)} />
                ))}
              </section>
            ))}
          </div>
          {sel && (
            <aside className="reviews-side">
              <div className="reviews-side-head">
                <div>
                  <div className="reviews-kind">{label(sel.target)?.kind}</div>
                  <h3>{label(sel.target)?.name ?? 'Deleted'}</h3>
                </div>
                {label(sel.target) && (
                  <button className="btn" onClick={() => open(sel.target)}>
                    <ExternalLink size={14} /> Open
                  </button>
                )}
              </div>
              <ReviewThread key={reviewKey(sel.target)} target={sel.target} />
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

function Card({ entry, name, kind, active, onClick }: { entry: ReviewEntry; name: string; kind: string; active: boolean; onClick(): void }) {
  const count = openComments(entry)
  const last = entry.comments.filter((c) => !c.resolved).at(-1)
  return (
    <button className={`reviews-card${active ? ' on' : ''}`} onClick={onClick}>
      <span className="reviews-kind">{kind}</span>
      <strong>{name}</strong>
      {last && (
        <span className="reviews-last">
          {last.author}: {last.text}
        </span>
      )}
      {count > 0 && (
        <span className="reviews-count">
          <MessageSquare size={11} /> {count}
        </span>
      )}
    </button>
  )
}
