import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { newId, type Category, type CategoryKind, type EntityType } from '@/core/model'
import { cleanOptions, ENTITY_LABELS, findByName, KIND_LABELS, KINDS, newCategory, validateCategoryName } from './logic'
import { NEW_STYLE, stylesFromRows, type OptionRow } from './optionRows'
import { BORDERS, STYLE_ICONS } from './styles'

/** Ordered list of dropdown options with add, remove and reorder (order drives sorting, e.g. Common < Rare). */
export function OptionsEditor({ rows, onChange, styled = false }: { rows: OptionRow[]; onChange: (rows: OptionRow[]) => void; styled?: boolean }) {
  // The row added last gets focus when it mounts, so the user can keep typing.
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const add = () => {
    const key = newId()
    setFocusKey(key)
    onChange([...rows, { key, original: null, value: '', style: styled ? NEW_STYLE : undefined }])
  }
  const move = (i: number, by: number) => {
    const j = i + by
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="cat-options">
      {rows.map((r, i) => (
        <div className="cat-option" key={r.key}>
          <input
            className="input cat-input"
            aria-label={`Option ${i + 1}`}
            placeholder="Option"
            autoFocus={r.key === focusKey}
            value={r.value}
            onChange={(e) => onChange(rows.map((x) => (x.key === r.key ? { ...x, value: e.target.value } : x)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (i === rows.length - 1) {
                  if (r.value.trim()) add()
                } else {
                  setFocusKey(null)
                  ;(e.currentTarget.closest('.cat-option')?.nextElementSibling?.querySelector('input') as HTMLInputElement | null)?.focus()
                }
              }
            }}
          />
          {styled && <StyleControls row={r} onChange={(style) => onChange(rows.map((x) => (x.key === r.key ? { ...x, style } : x)))} />}
          <button type="button" className="icon-btn" title="Move up" aria-label="Move option up" disabled={i === 0} onClick={() => move(i, -1)}>
            <ArrowUp size={14} />
          </button>
          <button type="button" className="icon-btn" title="Move down" aria-label="Move option down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
            <ArrowDown size={14} />
          </button>
          <button type="button" className="icon-btn" title="Remove option" aria-label="Remove option" onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost cat-add-option" onClick={add}>
        <Plus size={14} /> Add option
      </button>
    </div>
  )
}

/** Color, border and icon of one option (v0.6). */
function StyleControls({ row, onChange }: { row: OptionRow; onChange: (style: NonNullable<OptionRow['style']>) => void }) {
  const style = row.style ?? NEW_STYLE
  return (
    <span className="cat-style-controls">
      <input type="color" className="cat-style-color" title="Color" aria-label="Color" value={style.color} onChange={(e) => onChange({ ...style, color: e.target.value })} />
      <select className="input cat-style-select" title="Border" aria-label="Border" value={style.border} onChange={(e) => onChange({ ...style, border: e.target.value as typeof style.border })}>
        {BORDERS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <select className="input cat-style-select" title="Icon" aria-label="Icon" value={style.icon ?? ''} onChange={(e) => onChange({ ...style, icon: e.target.value || null })}>
        <option value="">No icon</option>
        {Object.keys(STYLE_ICONS).map((k) => (
          <option key={k} value={k}>
            {k[0].toUpperCase() + k.slice(1)}
          </option>
        ))}
      </select>
    </span>
  )
}

/** "Colors, borders and icons" switch for a dropdown category. */
export function StyledToggle({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="cat-styled-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> Colors, borders and icons (like rarities)
    </label>
  )
}

export function KindSelect({ value, onChange, id }: { value: CategoryKind; onChange: (k: CategoryKind) => void; id?: string }) {
  return (
    <select id={id} className="input cat-input" value={value} onChange={(e) => onChange(e.target.value as CategoryKind)}>
      {KINDS.map((k) => (
        <option key={k} value={k}>
          {KIND_LABELS[k]}
        </option>
      ))}
    </select>
  )
}

/**
 * Create a category inline. With defaultScope "this" the caller adds the current
 * entity to the selected list; "all" shows it on every entity of the type (IT-5).
 */
export function NewCategoryForm({
  type,
  categories,
  defaultScope,
  onCreate,
  onCancel,
  onUseExisting,
}: {
  type: EntityType
  categories: Category[]
  defaultScope: 'this' | 'all'
  onCreate: (c: Category) => void
  onCancel: () => void
  /** Offered when the name matches an existing category, e.g. built-in "Element" (IT-6). */
  onUseExisting?: (c: Category) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('dropdown')
  const [rows, setRows] = useState<OptionRow[]>([{ key: newId(), original: null, value: '' }])
  const [scope, setScope] = useState(defaultScope)
  const [styled, setStyled] = useState(false)
  const [touched, setTouched] = useState(false)
  const error = validateCategoryName(categories, name)
  const existing = findByName(categories, name)
  const label = ENTITY_LABELS[type]
  const options = cleanOptions(rows.map((r) => r.value))
  const optionsError = kind === 'dropdown' && options.length === 0 ? 'Add at least one option.' : null

  return (
    <form
      className="cat-form"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (error || optionsError) return
        const created = newCategory(name, kind, options, type, scope === 'all' ? { mode: 'all' } : { mode: 'selected', ids: [] })
        onCreate(kind === 'dropdown' && styled ? { ...created, styles: stylesFromRows(rows) } : created)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault() // ED-7: our Esc, not Layout Mode
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <div className="cat-form-title">New category</div>
      <label className="cat-form-row">
        <span>Name</span>
        <input className="input cat-input" autoFocus placeholder="e.g. Element" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="cat-form-row">
        <span>Type</span>
        <KindSelect value={kind} onChange={setKind} />
      </label>
      {kind === 'dropdown' && (
        <div className="cat-form-row">
          <span>Options</span>
          <div>
            <StyledToggle checked={styled} onChange={setStyled} />
            <OptionsEditor rows={rows} onChange={setRows} styled={styled} />
          </div>
        </div>
      )}
      <div className="cat-form-row">
        <span>Show on</span>
        <div className="cat-radio-group" role="radiogroup">
          <label>
            <input type="radio" checked={scope === 'this'} onChange={() => setScope('this')} /> {defaultScope === 'this' ? `This ${label.one} only` : `Selected ${label.many.toLowerCase()} only`}
          </label>
          <label>
            <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /> All {label.many.toLowerCase()}
          </label>
        </div>
      </div>
      {existing && onUseExisting ? (
        <div className="cat-hint cat-existing">
          "{existing.name}" already exists ({KIND_LABELS[existing.kind].toLowerCase()}).
          <button type="button" className="btn" onClick={() => onUseExisting(existing)}>
            Use existing
          </button>
        </div>
      ) : (
        touched && (error || optionsError) && <div className="cat-error">{error ?? optionsError}</div>
      )}
      <div className="cat-form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Create
        </button>
      </div>
    </form>
  )
}
