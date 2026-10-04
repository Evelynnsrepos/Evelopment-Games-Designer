import { Link2, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { newId, type ComponentType, type Id } from '@/core/model'
import { getManifest, type PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys } from '@/core/state'
import { Kanban, moveCard } from '@/shared/kanban'
import '@/shared/listDetail/listDetail.css'
import { combineRefProviders, rankRefItems, useEntityRefProvider, type RefItem } from '@/shared/richtext'
import { ProofTextarea } from '@/shared/spell'
import { useArticleRefProvider } from '@/shared/wiki'
import { openComponent } from '@/shell/editor/actions'
import './tasks.css'

/** Task board (v0.10): to-dos linked to the items, characters, articles and documents they are about. */

const COLUMNS = [
  { id: 'todo', title: 'To do', color: '#9aa0a6' },
  { id: 'doing', title: 'Doing', color: '#3e8ef7' },
  { id: 'review', title: 'Review', color: '#f08c00' },
  { id: 'done', title: 'Done', color: '#2f9e44' },
]
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const

interface TaskLink {
  kind: string
  id: Id
}

interface Task {
  id: Id
  title: string
  notes: string
  column: string
  assignee: string
  due: string
  priority: (typeof PRIORITIES)[number]
  links: TaskLink[]
}

interface TasksDoc {
  items: Task[]
}

const createTasksDoc = (): TasksDoc => ({ items: [] })
const newTask = (column: string): Task => ({ id: newId(), title: 'New task', notes: '', column, assignee: '', due: '', priority: 'Normal', links: [] })

export default function View({ active }: PanelProps) {
  const doc = useDocument<TasksDoc>('tasks', 'tasks', createTasksDoc)
  useUndoRedoKeys(doc, active)
  const entityRefs = useEntityRefProvider()
  const articleRefs = useArticleRefProvider()
  const refs = useMemo(() => combineRefProviders(entityRefs, articleRefs), [entityRefs, articleRefs])
  const documents = useProjectStore((s) => s.meta?.documents ?? [])
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  if (!doc.data) return null
  const d = doc.data
  const set = (fn: (d: TasksDoc) => TasksDoc) => doc.update(fn)
  const edit = (id: Id, patch: Partial<Task>) => set((x) => ({ ...x, items: x.items.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  const t = d.items.find((x) => x.id === openId)

  const docItems: RefItem[] = documents.map((doc) => ({ kind: `doc:${doc.type}`, id: doc.id, label: doc.title, hint: getManifest(doc.type)?.name }))
  const label = (l: TaskLink): RefItem | undefined => (l.kind.startsWith('doc:') ? docItems.find((x) => x.id === l.id) : refs.resolve(l))
  const open = (l: TaskLink) => (l.kind.startsWith('doc:') ? openComponent(l.kind.slice(4) as ComponentType, l.id) : refs.open?.(l))
  const suggestions = query.trim() ? rankRefItems([...refs.search(query), ...docItems], query, 8) : []
  const shown = filter ? d.items.filter((x) => x.assignee.toLowerCase().includes(filter.toLowerCase()) || x.title.toLowerCase().includes(filter.toLowerCase())) : d.items

  return (
    <div className="tk">
      <div className="ld-toolbar">
        <input className="input" style={{ width: 220 }} placeholder="Filter by title or person" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="muted">
          {d.items.filter((x) => x.column !== 'done').length} open, {d.items.filter((x) => x.column === 'done').length} done
        </span>
      </div>
      <div className="tk-body">
        <Kanban
          columns={COLUMNS}
          cards={shown}
          columnOf={(x) => x.column}
          selectedId={openId}
          onOpen={setOpenId}
          onAdd={(col) => {
            const n = newTask(col)
            set((x) => ({ ...x, items: [...x.items, n] }))
            setOpenId(n.id)
          }}
          onMove={(id, col, before) => set((x) => ({ ...x, items: moveCard(x.items, id, before, (c) => ({ ...c, column: col })) }))}
          renderCard={(x) => (
            <>
              <div className="kb-card-title">{x.title}</div>
              <div className="kb-card-meta">
                {x.priority !== 'Normal' && <span className={`kb-chip tk-p-${x.priority.toLowerCase()}`}>{x.priority}</span>}
                {x.assignee && <span className="kb-chip">{x.assignee}</span>}
                {x.due && <span className="kb-chip">{x.due}</span>}
                {x.links.slice(0, 3).map((l) => (
                  <span key={l.id} className="kb-chip tk-link">
                    <Link2 size={10} /> {label(l)?.label ?? 'missing'}
                  </span>
                ))}
              </div>
            </>
          )}
        />
        {t && (
          <aside className="tk-side">
            <div className="ld-inline">
              <input className="input" style={{ flex: 1, fontWeight: 600 }} value={t.title} onChange={(e) => edit(t.id, { title: e.target.value })} aria-label="Task" />
              <button className="icon-btn" aria-label="Close" onClick={() => setOpenId(null)}>
                <X size={14} />
              </button>
            </div>
            <label className="ld-field">
              <span>Who</span>
              <input className="input" value={t.assignee} onChange={(e) => edit(t.id, { assignee: e.target.value })} />
            </label>
            <label className="ld-field">
              <span>Due</span>
              <input className="input" type="date" value={t.due} onChange={(e) => edit(t.id, { due: e.target.value })} />
            </label>
            <label className="ld-field">
              <span>Priority</span>
              <select className="input" value={t.priority} onChange={(e) => edit(t.id, { priority: e.target.value as Task['priority'] })}>
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="ld-field">
              <span>Notes</span>
              <ProofTextarea className="input" rows={4} value={t.notes} onChange={(e) => edit(t.id, { notes: e.target.value })} />
            </label>
            <div className="ld-section">
              <strong>Linked to</strong>
              {t.links.map((l) => (
                <div key={l.id} className="ld-inline">
                  <button className="btn btn-ghost" onClick={() => open(l)}>
                    <Link2 size={12} /> {label(l)?.label ?? 'missing'} <span className="muted">{label(l)?.hint}</span>
                  </button>
                  <button className="icon-btn" aria-label="Remove link" onClick={() => edit(t.id, { links: t.links.filter((o) => o.id !== l.id) })}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <input className="input" placeholder="Link an item, character, article or document…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {suggestions.map((s) => (
                <button
                  key={`${s.kind}:${s.id}`}
                  className="tk-suggest"
                  onClick={() => {
                    if (!t.links.some((l) => l.id === s.id)) edit(t.id, { links: [...t.links, { kind: s.kind, id: s.id }] })
                    setQuery('')
                  }}
                >
                  {s.label} <span className="muted">{s.hint}</span>
                </button>
              ))}
            </div>
            <button
              className="btn btn-danger ld-danger"
              onClick={() => {
                set((x) => ({ ...x, items: x.items.filter((o) => o.id !== t.id) }))
                setOpenId(null)
              }}
            >
              <Trash2 size={14} /> Delete task
            </button>
          </aside>
        )}
      </div>
    </div>
  )
}
