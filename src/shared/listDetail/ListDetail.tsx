import { Plus, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import './listDetail.css'

export interface ListRow {
  id: string
  label: string
  sub?: string
  color?: string
}

/**
 * The common layout of list tools (v0.10): toolbar with New and search, a list
 * on the left and the selected entry's page on the right.
 */
export function ListDetail({
  rows,
  selectedId,
  onSelect,
  onAdd,
  addLabel,
  empty,
  toolbar,
  children,
}: {
  rows: ListRow[]
  selectedId: string | null
  onSelect(id: string): void
  onAdd?(): void
  addLabel?: string
  empty: string
  toolbar?: ReactNode
  children?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((r) => `${r.label} ${r.sub ?? ''}`.toLowerCase().includes(q)) : rows
  return (
    <div className="ld">
      <div className="ld-toolbar">
        {onAdd && (
          <button className="btn btn-primary" onClick={onAdd}>
            <Plus size={14} /> {addLabel}
          </button>
        )}
        <label className="ld-search">
          <Search size={14} />
          <input className="input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {toolbar}
      </div>
      <div className="ld-body">
        <div className="ld-list">
          {rows.length === 0 && <p className="muted ld-empty">{empty}</p>}
          {shown.map((r) => (
            <button key={r.id} className={`ld-row${r.id === selectedId ? ' on' : ''}`} onClick={() => onSelect(r.id)}>
              {r.color && <span className="ld-dot" style={{ background: r.color }} />}
              <span className="ld-row-main">
                <span className="ld-row-name">{r.label || 'Untitled'}</span>
                {r.sub && <span className="ld-row-sub">{r.sub}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="ld-detail">{children}</div>
      </div>
    </div>
  )
}

/** A labelled field on a detail page. */
export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`ld-field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}
