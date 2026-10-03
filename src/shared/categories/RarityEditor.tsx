import { ArrowDown, ArrowUp, ImagePlus, Plus, Star, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { create } from 'zustand'
import { pickAndImportAssets } from '@/core/assets'
import {
  builtInCategories,
  ENTITY_TYPES,
  newId,
  type Category,
  type EntityType,
  type Id,
  type OptionStyle,
  type StyleDisplay,
  type StyleField,
} from '@/core/model'
import { useProjectStore } from '@/core/state'
import { confirmDialog, promptDialog } from '../dialogs'
import { Modal } from '../ui'
import { ENTITY_LABELS, setScopeMode, scopeOf } from './logic'
import { NEW_STYLE, renamesFromRows, type OptionRow } from './optionRows'
import { renameOptionValues } from './store'
import { BORDERS, DEFAULT_RARITY_STYLES, displayOf, frameStyle, isRarity, isStyled, ratingText, StyleBadge, STYLE_ICONS } from './styles'

/** Open state of the Rarities window (sidebar button, Categories). */
export const useRaritiesWindow = create<{ open: boolean }>()(() => ({ open: false }))
export const openRarities = () => useRaritiesWindow.setState({ open: true })

const UI = {
  title: 'Rarities',
  intro:
    'Define your rarity systems once and use them everywhere. A system is a ranked list like Rarity, Tier, Quality or Threat level; each can have its own lists, looks and fields.',
  systems: 'Systems',
  newSystem: 'New system',
  newSystemName: 'Name of the new system, e.g. Tier or Quality',
  systemName: 'Name',
  borders: 'Show borders around cards and pictures',
  rating: 'Rating',
  ratingModes: { none: 'Hidden', stars: 'Stars (1 to 5)', number: 'Number (e.g. 4.5)' } as Record<StyleDisplay['rating'], string>,
  usedFor: 'Used for',
  fields: 'Your own fields',
  fieldsHint: 'Anything each rarity should carry, like a drop rate, a sell price multiplier or a max level. Shown on pages and in the wiki.',
  addField: 'Add field',
  fieldName: 'Name of the field, e.g. Drop rate %',
  add: 'Add rarity',
  name: 'Name',
  color: 'Color',
  border: 'Border',
  icon: 'Icon',
  picture: 'Your picture…',
  preview: 'Preview',
  deleteSystem: 'Delete system',
  cancel: 'Cancel',
  save: 'Save',
  empty: 'Add at least one rarity.',
  duplicate: 'Two rarities have the same name.',
}

interface Row extends OptionRow {
  style: OptionStyle
}

interface Draft {
  category: Category
  rows: Row[]
  display: StyleDisplay
  /** Not in the project yet (made with New system). */
  isNew: boolean
}

function draftOf(c: Category, isNew = false): Draft {
  const saved = c.styles ?? (isRarity(c) ? DEFAULT_RARITY_STYLES : {})
  return {
    category: c,
    rows: c.options.map((o) => ({ key: newId(), original: o, value: o, style: { ...NEW_STYLE, ...saved[o] } })),
    display: displayOf(c),
    isNew,
  }
}

function draftError(d: Draft): string | null {
  const names = d.rows.map((r) => r.value.trim())
  if (names.filter(Boolean).length === 0) return UI.empty
  if (new Set(names.filter(Boolean)).size !== names.filter(Boolean).length) return UI.duplicate
  return null
}

export function RaritiesHost() {
  const open = useRaritiesWindow((s) => s.open)
  const has = useProjectStore((s) => !!s.meta)
  return open && has ? <RarityEditor onClose={() => useRaritiesWindow.setState({ open: false })} /> : null
}

/** The Rarities window: every rarity system of the project, with looks, ratings and your own fields. */
function RarityEditor({ onClose }: { onClose: () => void }) {
  const categories = useProjectStore((s) => s.categories)
  const entities = useProjectStore((s) => s.entities)
  const root = useProjectStore((s) => s.root)
  // Drafts of every system, so switching between them keeps unsaved changes.
  const [drafts, setDrafts] = useState<Record<Id, Draft>>(() => {
    const systems = categories.filter(isStyled)
    if (!systems.some(isRarity) && !categories.some(isRarity)) {
      // The built-in Rarity was deleted: offer a fresh one.
      systems.unshift({ ...builtInCategories().find((c) => c.name === 'Rarity')!, id: newId() })
    }
    return Object.fromEntries(systems.map((c) => [c.id, draftOf(c, !categories.some((x) => x.id === c.id))]))
  })
  const [order, setOrder] = useState<Id[]>(() => Object.keys(drafts))
  const [selectedId, setSelectedId] = useState<Id>(() => order[0])
  const [deleted, setDeleted] = useState<Id[]>([])
  const d = drafts[selectedId]
  const errors = order.map((id) => drafts[id] && draftError(drafts[id])).filter(Boolean)

  const change = (patch: Partial<Draft>) => setDrafts({ ...drafts, [selectedId]: { ...d, ...patch } })
  const setRows = (rows: Row[]) => change({ rows })
  const setStyle = (key: string, patch: Partial<OptionStyle>) => setRows(d.rows.map((r) => (r.key === key ? { ...r, style: { ...r.style, ...patch } } : r)))
  const setValue = (key: string, field: Id, value: string | number | null) =>
    setRows(d.rows.map((r) => (r.key === key ? { ...r, style: { ...r.style, values: { ...r.style.values, [field]: value } } } : r)))
  const move = (i: number, by: number) => {
    const j = i + by
    if (j < 0 || j >= d.rows.length) return
    const next = [...d.rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows(next)
  }
  const fields = d?.category.fields ?? []
  // Header and rows share one grid so the columns line up.
  const grid = d
    ? [
        '26px',
        'minmax(110px, 1fr)',
        '38px',
        d.display.borders ? '112px' : '',
        '150px',
        d.display.rating === 'stars' ? '112px' : d.display.rating === 'number' ? '80px' : '',
        ...fields.map(() => '90px'),
        '180px',
        '30px',
      ]
        .filter(Boolean)
        .join(' ')
    : ''
  const setFields = (next: StyleField[]) => change({ category: { ...d.category, fields: next } })

  const newSystem = async () => {
    const name = (await promptDialog(UI.newSystemName, ''))?.trim()
    if (!name) return
    const c: Category = {
      id: newId(),
      name,
      kind: 'dropdown',
      options: ['Low', 'Medium', 'High'],
      appliesTo: { item: { mode: 'all' } },
      builtIn: false,
      styles: {
        Low: { color: '#9aa0a6', border: 'none', icon: null, rating: 1 },
        Medium: { color: '#3e8ef7', border: 'solid', icon: null, rating: 3 },
        High: { color: '#f5a623', border: 'glow', icon: 'star', rating: 5 },
      },
      display: { borders: true, rating: 'none' },
    }
    setDrafts({ ...drafts, [c.id]: draftOf(c, true) })
    setOrder([...order, c.id])
    setSelectedId(c.id)
  }

  const deleteSystem = async () => {
    const ok = await confirmDialog({
      title: `Delete ${d.category.name}?`,
      message: 'The system disappears from every list. Values already chosen stay hidden on the entries and come back if you undo.',
      confirmLabel: UI.deleteSystem,
      danger: true,
    })
    if (!ok) return
    if (!d.isNew) setDeleted([...deleted, selectedId])
    const rest = order.filter((id) => id !== selectedId)
    setOrder(rest)
    const next = { ...drafts }
    delete next[selectedId]
    setDrafts(next)
    setSelectedId(rest[0])
  }

  const pickPicture = async (key: string) => {
    if (!root) return
    const [asset] = await pickAndImportAssets(root, 'image', 'Choose an icon picture')
    if (asset) setStyle(key, { image: asset.path })
  }

  const save = () => {
    if (errors.length) return
    const store = useProjectStore.getState()
    let list = store.categories.filter((c) => !deleted.includes(c.id))
    const renames: [Id, Record<string, string>][] = []
    for (const id of order) {
      const x = drafts[id]
      const kept = x.rows.filter((r) => r.value.trim())
      const next: Category = {
        ...x.category,
        kind: 'dropdown',
        options: kept.map((r) => r.value.trim()),
        styles: Object.fromEntries(kept.map((r) => [r.value.trim(), r.style])),
        display: x.display,
      }
      list = list.some((c) => c.id === id) ? list.map((c) => (c.id === id ? next : c)) : [...list, next]
      const renamed = renamesFromRows(kept)
      if (Object.keys(renamed).length) renames.push([id, renamed])
    }
    store.setCategories(list)
    for (const [id, renamed] of renames) renameOptionValues(id, renamed)
    onClose()
  }

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

        <div className="rarity-body">
          <nav className="rarity-systems" aria-label={UI.systems}>
            {order.map((id) => (
              <button key={id} className={`rarity-system${id === selectedId ? ' is-active' : ''}`} onClick={() => setSelectedId(id)}>
                {drafts[id].category.name || '…'}
                {draftError(drafts[id]) && <span className="cat-error"> !</span>}
              </button>
            ))}
            <button className="btn btn-ghost rarity-add" onClick={() => void newSystem()}>
              <Plus size={14} /> {UI.newSystem}
            </button>
          </nav>

          {d ? (
            <div className="rarity-main">
              <div className="rarity-settings">
                <label className="rarity-setting">
                  <span>{UI.systemName}</span>
                  <input className="input" value={d.category.name} onChange={(e) => change({ category: { ...d.category, name: e.target.value } })} />
                </label>
                <label className="rarity-check">
                  <input type="checkbox" checked={d.display.borders} onChange={(e) => change({ display: { ...d.display, borders: e.target.checked } })} /> {UI.borders}
                </label>
                <label className="rarity-setting">
                  <span>{UI.rating}</span>
                  <select className="input" value={d.display.rating} onChange={(e) => change({ display: { ...d.display, rating: e.target.value as StyleDisplay['rating'] } })}>
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
                        checked={scopeOf(d.category, t).mode !== 'none'}
                        onChange={(e) => change({ category: setScopeMode(d.category, t, e.target.checked ? 'all' : 'none', entities[t].map((x) => x.id)) })}
                      />{' '}
                      {ENTITY_LABELS[t].many}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rarity-fields">
                <span className="rarity-setting-label">{UI.fields}</span>
                {fields.map((f) => (
                  <span key={f.id} className="rarity-field">
                    <input className="input" value={f.name} onChange={(e) => setFields(fields.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))} />
                    <select className="input" value={f.kind} onChange={(e) => setFields(fields.map((x) => (x.id === f.id ? { ...x, kind: e.target.value as StyleField['kind'] } : x)))}>
                      <option value="number">Number</option>
                      <option value="text">Text</option>
                    </select>
                    <button className="icon-btn" title="Remove field" onClick={() => setFields(fields.filter((x) => x.id !== f.id))}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
                <button
                  className="btn btn-ghost rarity-add"
                  onClick={async () => {
                    const name = (await promptDialog(UI.fieldName, ''))?.trim()
                    if (name) setFields([...fields, { id: newId(), name, kind: 'number' }])
                  }}
                >
                  <Plus size={14} /> {UI.addField}
                </button>
                {fields.length === 0 && <span className="muted rarity-hint">{UI.fieldsHint}</span>}
              </div>

              <div className="rarity-table">
                <div className="rarity-row rarity-labels" style={{ gridTemplateColumns: grid }}>
                  <span />
                  <span className="rarity-col-name">{UI.name}</span>
                  <span>{UI.color}</span>
                  {d.display.borders && <span>{UI.border}</span>}
                  <span>{UI.icon}</span>
                  {d.display.rating !== 'none' && <span>{UI.rating}</span>}
                  {fields.map((f) => (
                    <span key={f.id} className="rarity-col-field">
                      {f.name}
                    </span>
                  ))}
                  <span>{UI.preview}</span>
                  <span />
                </div>
                {d.rows.map((r, i) => (
                  <div key={r.key} className="rarity-row" style={{ gridTemplateColumns: grid }}>
                    <span className="rarity-move">
                      <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp size={13} />
                      </button>
                      <button className="icon-btn" title="Move down" disabled={i === d.rows.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown size={13} />
                      </button>
                    </span>
                    <input className="input rarity-col-name" value={r.value} placeholder={UI.name} onChange={(e) => setRows(d.rows.map((x) => (x.key === r.key ? { ...x, value: e.target.value } : x)))} />
                    <input type="color" className="rarity-color" value={r.style.color} onChange={(e) => setStyle(r.key, { color: e.target.value })} />
                    {d.display.borders && (
                      <select className="input" value={r.style.border} onChange={(e) => setStyle(r.key, { border: e.target.value as OptionStyle['border'] })}>
                        {BORDERS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="rarity-icon">
                      <select
                        className="input"
                        value={r.style.image ? '__picture' : (r.style.icon ?? '')}
                        onChange={(e) => {
                          if (e.target.value === '__picture') void pickPicture(r.key)
                          else setStyle(r.key, { icon: e.target.value || null, image: null })
                        }}
                      >
                        <option value="">None</option>
                        {Object.keys(STYLE_ICONS).map((k) => (
                          <option key={k} value={k}>
                            {k[0].toUpperCase() + k.slice(1)}
                          </option>
                        ))}
                        <option value="__picture">{UI.picture}</option>
                      </select>
                      {r.style.image && (
                        <button className="icon-btn" title="Choose another picture" onClick={() => void pickPicture(r.key)}>
                          <ImagePlus size={13} />
                        </button>
                      )}
                    </span>
                    {d.display.rating === 'stars' && <StarPicker value={r.style.rating ?? 0} onChange={(rating) => setStyle(r.key, { rating })} />}
                    {d.display.rating === 'number' && (
                      <input
                        className="input rarity-number"
                        type="number"
                        step="0.1"
                        value={r.style.rating ?? ''}
                        onChange={(e) => setStyle(r.key, { rating: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    )}
                    {fields.map((f) => (
                      <input
                        key={f.id}
                        className="input rarity-col-field"
                        type={f.kind === 'number' ? 'number' : 'text'}
                        value={r.style.values?.[f.id] ?? ''}
                        onChange={(e) => setValue(r.key, f.id, e.target.value === '' ? null : f.kind === 'number' ? Number(e.target.value) : e.target.value)}
                      />
                    ))}
                    <span className="rarity-preview" style={frameStyle(d.display.borders ? r.style : null)}>
                      <StyleBadge style={r.style} label={r.value || '…'} rating={ratingText({ ...d.category, display: d.display }, r.style)} small />
                    </span>
                    <button className="icon-btn" title="Remove rarity" onClick={() => setRows(d.rows.filter((x) => x.key !== r.key))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="rarity-table-actions">
                  <button
                    className="btn btn-ghost rarity-add"
                    onClick={() => setRows([...d.rows, { key: newId(), original: null, value: '', style: { ...NEW_STYLE, rating: Math.min(5, d.rows.length + 1) } }])}
                  >
                    <Plus size={14} /> {UI.add}
                  </button>
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-ghost collab-danger" onClick={() => void deleteSystem()}>
                    <Trash2 size={14} /> {UI.deleteSystem}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rarity-main muted">Make a system with New system.</div>
          )}
        </div>

        {errors.length > 0 && <div className="cat-error">{errors[0]}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {UI.cancel}
          </button>
          <button className="btn btn-primary" disabled={errors.length > 0} onClick={save}>
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
