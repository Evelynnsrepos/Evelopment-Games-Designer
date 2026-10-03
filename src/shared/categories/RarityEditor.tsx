import { ArrowDown, ArrowUp, Plus, Star, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { create } from 'zustand'
import { builtInCategories, ENTITY_TYPES, newId, type Category, type EntityType, type OptionStyle, type StyleDisplay } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { Modal } from '../ui'
import { ENTITY_LABELS, setScopeMode, scopeOf } from './logic'
import { NEW_STYLE, renamesFromRows, type OptionRow } from './optionRows'
import { renameOptionValues } from './store'
import { BORDERS, DEFAULT_RARITY_STYLES, displayOf, frameStyle, isRarity, ratingText, StyleBadge, STYLE_ICONS } from './styles'

/** Open state of the Rarities window (sidebar button, Categories). */
export const useRaritiesWindow = create<{ open: boolean }>()(() => ({ open: false }))
export const openRarities = () => useRaritiesWindow.setState({ open: true })

const UI = {
  title: 'Rarities',
  intro: 'Define the rarities of your game once; items and characters show them everywhere: cards, tables, pages, the wiki and links.',
  borders: 'Show borders around cards and pictures',
  rating: 'Rating',
  ratingModes: { none: 'Hidden', stars: 'Stars (1 to 5)', number: 'Number (e.g. 4.5)' } as Record<StyleDisplay['rating'], string>,
  usedFor: 'Used for',
  add: 'Add rarity',
  name: 'Name',
  color: 'Color',
  border: 'Border',
  icon: 'Icon',
  preview: 'Preview',
  cancel: 'Cancel',
  save: 'Save',
  empty: 'Add at least one rarity.',
  duplicate: 'Two rarities have the same name.',
}

interface Row extends OptionRow {
  style: OptionStyle
}

export function RaritiesHost() {
  const open = useRaritiesWindow((s) => s.open)
  const has = useProjectStore((s) => !!s.meta)
  return open && has ? <RarityEditor onClose={() => useRaritiesWindow.setState({ open: false })} /> : null
}

/** The Rarities window: names, colors, borders, icons and ratings of the project's rarities. */
function RarityEditor({ onClose }: { onClose: () => void }) {
  const categories = useProjectStore((s) => s.categories)
  const entities = useProjectStore((s) => s.entities)
  // Edit the built-in Rarity; if it was deleted, start a fresh one.
  const [base] = useState<Category>(() => categories.find(isRarity) ?? { ...builtInCategories().find((c) => c.name === 'Rarity')!, id: newId() })
  const saved = base.styles ?? DEFAULT_RARITY_STYLES
  const [rows, setRows] = useState<Row[]>(() => base.options.map((o) => ({ key: newId(), original: o, value: o, style: { ...NEW_STYLE, ...saved[o] } })))
  const [display, setDisplay] = useState<StyleDisplay>(() => displayOf(base))
  const [category, setCategory] = useState(base)
  const names = rows.map((r) => r.value.trim())
  const error = names.filter(Boolean).length === 0 ? UI.empty : new Set(names).size !== names.length ? UI.duplicate : null

  const setRow = (key: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const setStyle = (key: string, patch: Partial<OptionStyle>) => setRows(rows.map((r) => (r.key === key ? { ...r, style: { ...r.style, ...patch } } : r)))
  const move = (i: number, by: number) => {
    const j = i + by
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows(next)
  }

  const save = () => {
    if (error) return
    const kept = rows.filter((r) => r.value.trim())
    const next: Category = {
      ...category,
      kind: 'dropdown',
      options: kept.map((r) => r.value.trim()),
      styles: Object.fromEntries(kept.map((r) => [r.value.trim(), r.style])),
      display,
    }
    const store = useProjectStore.getState()
    const exists = store.categories.some((c) => c.id === next.id)
    store.setCategories(exists ? store.categories.map((c) => (c.id === next.id ? next : c)) : [next, ...store.categories])
    const renamed = renamesFromRows(kept)
    if (Object.keys(renamed).length) renameOptionValues(next.id, renamed)
    onClose()
  }

  const previewCategory: Category = { ...category, display, styles: Object.fromEntries(rows.map((r) => [r.value.trim(), r.style])) }

  return (
    <Modal onClose={onClose}>
      <div className="rarity">
        <div className="rarity-head">
          <h3>{UI.title}</h3>
          <button className="icon-btn" title={UI.cancel} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="muted">{UI.intro}</p>

        <div className="rarity-settings">
          <label className="rarity-check">
            <input type="checkbox" checked={display.borders} onChange={(e) => setDisplay({ ...display, borders: e.target.checked })} /> {UI.borders}
          </label>
          <label className="rarity-setting">
            <span>{UI.rating}</span>
            <select className="input" value={display.rating} onChange={(e) => setDisplay({ ...display, rating: e.target.value as StyleDisplay['rating'] })}>
              {(Object.keys(UI.ratingModes) as StyleDisplay['rating'][]).map((m) => (
                <option key={m} value={m}>
                  {UI.ratingModes[m]}
                </option>
              ))}
            </select>
          </label>
          <div className="rarity-setting">
            <span>{UI.usedFor}</span>
            {ENTITY_TYPES.map((t: EntityType) => (
              <label key={t} className="rarity-check">
                <input
                  type="checkbox"
                  checked={scopeOf(category, t).mode !== 'none'}
                  onChange={(e) => setCategory(setScopeMode(category, t, e.target.checked ? 'all' : 'none', entities[t].map((x) => x.id)))}
                />{' '}
                {ENTITY_LABELS[t].many}
              </label>
            ))}
          </div>
        </div>

        <div className="rarity-table">
          <div className="rarity-row rarity-labels">
            <span />
            <span>{UI.name}</span>
            <span>{UI.color}</span>
            {display.borders && <span>{UI.border}</span>}
            <span>{UI.icon}</span>
            {display.rating !== 'none' && <span>{UI.rating}</span>}
            <span>{UI.preview}</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={r.key} className="rarity-row">
              <span className="rarity-move">
                <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={13} />
                </button>
                <button className="icon-btn" title="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={13} />
                </button>
              </span>
              <input className="input" value={r.value} placeholder={UI.name} onChange={(e) => setRow(r.key, { value: e.target.value })} />
              <input type="color" className="rarity-color" value={r.style.color} onChange={(e) => setStyle(r.key, { color: e.target.value })} />
              {display.borders && (
                <select className="input" value={r.style.border} onChange={(e) => setStyle(r.key, { border: e.target.value as OptionStyle['border'] })}>
                  {BORDERS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              )}
              <select className="input" value={r.style.icon ?? ''} onChange={(e) => setStyle(r.key, { icon: e.target.value || null })}>
                <option value="">None</option>
                {Object.keys(STYLE_ICONS).map((k) => (
                  <option key={k} value={k}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </select>
              {display.rating === 'stars' && <StarPicker value={r.style.rating ?? 0} onChange={(rating) => setStyle(r.key, { rating })} />}
              {display.rating === 'number' && (
                <input
                  className="input rarity-number"
                  type="number"
                  step="0.1"
                  value={r.style.rating ?? ''}
                  onChange={(e) => setStyle(r.key, { rating: e.target.value === '' ? null : Number(e.target.value) })}
                />
              )}
              <span className="rarity-preview" style={frameStyle(display.borders ? r.style : null)}>
                <StyleBadge style={r.style} label={r.value || '…'} rating={ratingText(previewCategory, r.style)} small />
              </span>
              <button className="icon-btn" title="Remove rarity" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost rarity-add"
            onClick={() => setRows([...rows, { key: newId(), original: null, value: '', style: { ...NEW_STYLE, rating: Math.min(5, rows.length + 1) } }])}
          >
            <Plus size={14} /> {UI.add}
          </button>
        </div>

        {error && <div className="cat-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {UI.cancel}
          </button>
          <button className="btn btn-primary" disabled={!!error} onClick={save}>
            {UI.save}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Click a star to set 1 to 5; click the same star again for none. */
function StarPicker({ value, onChange }: { value: number; onChange: (v: number | null) => void }) {
  return (
    <span className="rarity-stars" role="radiogroup" aria-label="Stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={Math.round(value) === n} title={`${n}`} onClick={() => onChange(Math.round(value) === n ? null : n)}>
          <Star size={15} fill={n <= Math.round(value) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  )
}
