import { ArrowDown, ArrowUp, ListOrdered, Pencil, Plus, RotateCcw, Search, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { newId, type Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useUndoRedoKeys } from '@/core/state'
import { confirmDialog, promptDialog } from '@/shared/dialogs'
import { ProofTextarea } from '@/shared/spell'
import { createPrinciplesDoc, missingBuiltIns, movePrinciple, newPrinciple, restoreBuiltIns, visiblePrinciples, type Principle, type PrinciplesDoc, type SortMode } from './model'
import './principles.css'

const T = {
  all: 'All principles',
  rules: 'Rules',
  structures: 'Story structures',
  newCategory: 'New category',
  search: 'Search',
  add: 'New principle',
  restore: (n: number) => `Restore ${n} built-in`,
  sort: { custom: 'My order', az: 'A to Z', pinned: 'Starred first' } as Record<SortMode, string>,
  empty: 'Nothing here yet. Add your own with New principle.',
  title: 'Title',
  text: 'What it means',
  example: 'Example (optional)',
  done: 'Done',
  delete: 'Delete',
  deleteCategory: 'Delete category',
}

/** Writing Principles (v0.9): a collection of story rules and structures to keep, extend and sort. */
export default function View({ active }: PanelProps) {
  const doc = useDocument<PrinciplesDoc>('principles', 'principles', createPrinciplesDoc)
  useUndoRedoKeys(doc, active)
  const [categoryId, setCategoryId] = useState<Id | null>(null)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<Id | null>(null)
  if (!doc.data) return null
  const d = doc.data
  const set = (fn: (d: PrinciplesDoc) => PrinciplesDoc) => doc.update(fn)
  const edit = (id: Id, patch: Partial<Principle>) => set((x) => ({ ...x, principles: x.principles.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const category = d.categories.find((c) => c.id === categoryId) ?? null
  const shown = visiblePrinciples(d, categoryId, query)
  const missing = missingBuiltIns(d)
  const catName = (id: Id) => d.categories.find((c) => c.id === id)?.name ?? ''
  const isStructure = category?.kind === 'structure'

  const addPrinciple = () => {
    const target = categoryId ?? d.categories.find((c) => c.kind === 'rules')?.id ?? d.categories[0]?.id
    if (!target) return
    const p = newPrinciple(target)
    set((x) => ({ ...x, principles: [...x.principles, p] }))
    setEditingId(p.id)
    setQuery('')
  }
  const addCategory = async () => {
    const name = (await promptDialog(T.newCategory, ''))?.trim()
    if (!name) return
    const id = newId()
    set((x) => ({ ...x, categories: [...x.categories, { id, name, kind: 'rules', about: '' }] }))
    setCategoryId(id)
  }
  const removeCategory = async () => {
    if (!category) return
    const n = d.principles.filter((p) => p.categoryId === category.id).length
    if (!(await confirmDialog({ title: `Delete ${category.name}?`, message: `This deletes the category and its ${n} entries. You can undo with Ctrl+Z.`, confirmLabel: 'Delete', danger: true }))) return
    set((x) => ({ ...x, categories: x.categories.filter((c) => c.id !== category.id), principles: x.principles.filter((p) => p.categoryId !== category.id) }))
    setCategoryId(null)
  }

  const groups: [string, typeof d.categories][] = [
    [T.rules, d.categories.filter((c) => c.kind === 'rules')],
    [T.structures, d.categories.filter((c) => c.kind === 'structure')],
  ]

  return (
    <div className="wp">
      <nav className="wp-nav">
        <button className={`wp-cat${categoryId === null ? ' on' : ''}`} onClick={() => setCategoryId(null)}>
          {T.all} <span>{d.principles.length}</span>
        </button>
        {groups.map(([label, cats]) => (
          <div key={label}>
            <div className="wp-group">{label}</div>
            {cats.map((c) => (
              <button key={c.id} className={`wp-cat${c.id === categoryId ? ' on' : ''}`} onClick={() => setCategoryId(c.id)}>
                {c.kind === 'structure' && <ListOrdered size={13} />}
                {c.name} <span>{d.principles.filter((p) => p.categoryId === c.id).length}</span>
              </button>
            ))}
          </div>
        ))}
        <button className="btn btn-ghost wp-newcat" onClick={() => void addCategory()}>
          <Plus size={14} /> {T.newCategory}
        </button>
      </nav>

      <div className="wp-main">
        <div className="wp-toolbar">
          <button className="btn btn-primary" onClick={addPrinciple}>
            <Plus size={14} /> {T.add}
          </button>
          <label className="wp-search">
            <Search size={14} />
            <input className="input" placeholder={T.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <select className="input wp-sort" value={d.sort} onChange={(e) => set((x) => ({ ...x, sort: e.target.value as SortMode }))}>
            {(Object.keys(T.sort) as SortMode[]).map((s) => (
              <option key={s} value={s}>
                {T.sort[s]}
              </option>
            ))}
          </select>
          {missing > 0 && (
            <button className="btn btn-ghost" onClick={() => set(restoreBuiltIns)}>
              <RotateCcw size={14} /> {T.restore(missing)}
            </button>
          )}
        </div>

        {category && (
          <header className="wp-head">
            <div>
              <h2>{category.name}</h2>
              <textarea
                className="wp-about"
                rows={1}
                placeholder="What is this category about?"
                value={category.about}
                onChange={(e) => set((x) => ({ ...x, categories: x.categories.map((c) => (c.id === category.id ? { ...c, about: e.target.value } : c)) }))}
              />
            </div>
            <select
              className="input wp-sort"
              title="Rules are a list; a structure is a sequence of steps"
              value={category.kind}
              onChange={(e) => set((x) => ({ ...x, categories: x.categories.map((c) => (c.id === category.id ? { ...c, kind: e.target.value as 'rules' | 'structure' } : c)) }))}
            >
              <option value="rules">List of rules</option>
              <option value="structure">Story structure (steps)</option>
            </select>
            <button className="icon-btn" title={T.deleteCategory} aria-label={T.deleteCategory} onClick={() => void removeCategory()}>
              <Trash2 size={15} />
            </button>
          </header>
        )}

        <div className={`wp-list${isStructure ? ' steps' : ''}`}>
          {shown.length === 0 && <p className="muted">{T.empty}</p>}
          {shown.map((p, i) => {
            const isEditing = editingId === p.id
            return (
              <article key={p.id} className={`wp-card${p.pinned ? ' pinned' : ''}`}>
                {isStructure && <div className="wp-step">{i + 1}</div>}
                <div className="wp-card-main">
                  {isEditing ? (
                    <div className="wp-edit">
                      <input className="input" aria-label={T.title} value={p.title} autoFocus onChange={(e) => edit(p.id, { title: e.target.value })} />
                      <label>
                        {T.text}
                        <ProofTextarea className="input" rows={3} value={p.text} onChange={(e) => edit(p.id, { text: e.target.value })} />
                      </label>
                      <label>
                        {T.example}
                        <ProofTextarea className="input" rows={2} value={p.example} onChange={(e) => edit(p.id, { example: e.target.value })} />
                      </label>
                      <div className="wp-edit-row">
                        <select className="input wp-sort" value={p.categoryId} onChange={(e) => edit(p.id, { categoryId: e.target.value })}>
                          {d.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-primary" onClick={() => setEditingId(null)}>
                          {T.done}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 onDoubleClick={() => setEditingId(p.id)}>{p.title}</h3>
                      {!categoryId && <span className="wp-chip">{catName(p.categoryId)}</span>}
                      {p.text && <p>{p.text}</p>}
                      {p.example && <p className="wp-example">{p.example}</p>}
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="wp-actions">
                    <button className={`icon-btn${p.pinned ? ' starred' : ''}`} title="Star" aria-label="Star" onClick={() => edit(p.id, { pinned: !p.pinned })}>
                      <Star size={14} />
                    </button>
                    <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditingId(p.id)}>
                      <Pencil size={14} />
                    </button>
                    {d.sort === 'custom' && !query && (
                      <>
                        <button className="icon-btn" title="Move up" aria-label="Move up" onClick={() => set((x) => movePrinciple(x, p.id, -1))}>
                          <ArrowUp size={14} />
                        </button>
                        <button className="icon-btn" title="Move down" aria-label="Move down" onClick={() => set((x) => movePrinciple(x, p.id, 1))}>
                          <ArrowDown size={14} />
                        </button>
                      </>
                    )}
                    <button className="icon-btn" title={T.delete} aria-label={T.delete} onClick={() => set((x) => ({ ...x, principles: x.principles.filter((o) => o.id !== p.id) }))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
