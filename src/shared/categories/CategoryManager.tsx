import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ENTITY_TYPES, newId, type Category, type EntityType, type Id } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { confirmDialog } from '@/shared/dialogs'
import { Modal } from '@/shared/ui'
import { KindSelect, NewCategoryForm, OptionsEditor, StyledToggle } from './CategoryForm'
import { renamesFromRows, rowsFromOptions, stylesFromRows, type OptionRow } from './optionRows'
import { DEFAULT_RARITY_STYLES, isRarity, isStyled } from './styles'
import { cleanOptions, ENTITY_LABELS, isUsedFor, KIND_LABELS, scopeOf, setScopeMode, validateCategoryName, type ScopeMode } from './logic'
import './categories.css'

export interface CategoryChange {
  categories: Category[]
  /** Dropdown options renamed in this change: stored values should follow (see `renameOptionValues`). */
  renamed?: { categoryId: Id; renamed: Record<string, string> }
}

/**
 * Create, edit and delete the project's shared categories (spec 3.4).
 * `type` is the list it was opened from; that type is listed first, and every
 * category of the project is offered for it (IT-6).
 */
export function CategoryManager({
  type,
  categories,
  onChange,
  onClose,
}: {
  type: EntityType
  categories: Category[]
  onChange: (change: CategoryChange) => void
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState<Id | 'new' | null>(() => categories.find((c) => isUsedFor(c, type))?.id ?? categories[0]?.id ?? null)
  const selected = categories.find((c) => c.id === selectedId) ?? null
  const used = categories.filter((c) => isUsedFor(c, type))
  const other = categories.filter((c) => !isUsedFor(c, type))
  const label = ENTITY_LABELS[type]

  const listButton = (c: Category) => (
    <button key={c.id} className={`cat-list-item${c.id === selectedId ? ' selected' : ''}`} onClick={() => setSelectedId(c.id)}>
      <span>{c.name}</span>
      <small>{KIND_LABELS[c.kind]}</small>
    </button>
  )

  return (
    <Modal onClose={onClose}>
      <div className="cat-manager">
        <header className="cat-manager-header">
          <h3>Categories</h3>
          <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="cat-manager-body">
          <nav className="cat-list" aria-label="Categories">
            <button className="btn cat-new-btn" onClick={() => setSelectedId('new')}>
              <Plus size={14} /> New category
            </button>
            <div className="cat-list-heading">Used for {label.many.toLowerCase()}</div>
            {used.length ? used.map(listButton) : <div className="cat-empty">None yet</div>}
            {other.length > 0 && (
              <>
                <div className="cat-list-heading">Other categories in this project</div>
                {other.map(listButton)}
              </>
            )}
          </nav>
          <div className="cat-detail">
            {selectedId === 'new' ? (
              <NewCategoryForm
                type={type}
                categories={categories}
                defaultScope="all"
                onCancel={() => setSelectedId(categories[0]?.id ?? null)}
                onUseExisting={(c) => setSelectedId(c.id)}
                onCreate={(c) => {
                  onChange({ categories: [...categories, c] })
                  setSelectedId(c.id)
                }}
              />
            ) : selected ? (
              <CategoryEditor key={selected.id} type={type} category={selected} categories={categories} onChange={onChange} onDeleted={() => setSelectedId(null)} />
            ) : (
              <div className="cat-empty">Pick a category on the left, or create a new one.</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

const SCOPE_LABELS: Record<ScopeMode, string> = { none: 'Off', all: 'All', selected: 'Only selected' }

function CategoryEditor({
  type,
  category,
  categories,
  onChange,
  onDeleted,
}: {
  type: EntityType
  category: Category
  categories: Category[]
  onChange: (change: CategoryChange) => void
  onDeleted: () => void
}) {
  const entities = useProjectStore((s) => s.entities)
  const [name, setName] = useState(category.name)
  const [kind, setKind] = useState(category.kind)
  const savedStyles = category.styles ?? (isRarity(category) ? DEFAULT_RARITY_STYLES : undefined)
  const [rows, setRows] = useState<OptionRow[]>(() => rowsFromOptions(category.options, savedStyles))
  const [styled, setStyled] = useState(isStyled(category))
  const options = cleanOptions(rows.map((r) => r.value))
  const nameError = validateCategoryName(categories, name, category.id)
  const optionsError = kind === 'dropdown' && options.length === 0 ? 'Add at least one option.' : null
  const nextStyles = kind === 'dropdown' && styled ? stylesFromRows(rows) : undefined
  const dirty =
    name.trim() !== category.name ||
    kind !== category.kind ||
    options.join('\n') !== category.options.join('\n') ||
    styled !== isStyled(category) ||
    (styled && JSON.stringify(nextStyles) !== JSON.stringify(stylesFromRows(rowsFromOptions(category.options, savedStyles))))
  const types = [type, ...ENTITY_TYPES.filter((t) => t !== type)]
  const valueCount = ENTITY_TYPES.reduce(
    (n, t) => n + entities[t].filter((e) => e.categories[category.id] !== undefined && e.categories[category.id] !== null).length,
    0,
  )

  const replace = (c: Category) => categories.map((x) => (x.id === c.id ? c : x))

  const save = () => {
    if (nameError || optionsError) return
    const next: Category = { ...category, name: name.trim(), kind, options: kind === 'dropdown' ? options : [], styles: nextStyles }
    // Rarity without looks: store an empty map so the pre-saved defaults stay off.
    if (!nextStyles && isRarity(category)) next.styles = {}
    const renamed = kind === 'dropdown' && category.kind === 'dropdown' ? renamesFromRows(rows) : {}
    onChange({ categories: replace(next), renamed: Object.keys(renamed).length ? { categoryId: category.id, renamed } : undefined })
    setRows(rowsFromOptions(next.options, next.styles))
  }

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Delete "${category.name}"?`,
      message:
        valueCount > 0
          ? `${valueCount} ${valueCount === 1 ? 'entry has' : 'entries have'} a value for this category. The category disappears from every list.`
          : 'The category disappears from every list.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    onChange({ categories: categories.filter((c) => c.id !== category.id) })
    onDeleted()
  }

  return (
    <form
      className="cat-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label className="cat-form-row">
        <span>Name</span>
        <input className="input cat-input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="cat-form-row">
        <span>Type</span>
        <KindSelect
          value={kind}
          onChange={(k) => {
            setKind(k)
            // A fresh dropdown starts with one empty option to type into.
            if (k === 'dropdown' && rows.length === 0) setRows([{ key: newId(), original: null, value: '' }])
          }}
        />
      </label>
      {kind !== category.kind && valueCount > 0 && (
        <div className="cat-hint">Values that do not fit the new type are hidden, not deleted. Switch back to see them again.</div>
      )}
      {kind === 'dropdown' && (
        <div className="cat-form-row">
          <span>Options</span>
          <div>
            <StyledToggle checked={styled} onChange={setStyled} />
            <OptionsEditor rows={rows} onChange={setRows} styled={styled} />
          </div>
        </div>
      )}
      {dirty && (nameError || optionsError) && <div className="cat-error">{nameError ?? optionsError}</div>}
      <div className="cat-form-actions">
        {category.builtIn && <span className="cat-badge">Built-in</span>}
        <button type="button" className="btn btn-ghost cat-delete" onClick={() => void remove()}>
          <Trash2 size={14} /> Delete
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn"
          disabled={!dirty}
          onClick={() => {
            setName(category.name)
            setKind(category.kind)
            setRows(rowsFromOptions(category.options, savedStyles))
            setStyled(isStyled(category))
          }}
        >
          Revert
        </button>
        <button type="submit" className="btn btn-primary" disabled={!dirty || !!nameError || !!optionsError}>
          Save
        </button>
      </div>

      <div className="cat-scope">
        <div className="cat-form-title">Used for</div>
        {types.map((t) => {
          const scope = scopeOf(category, t)
          const allIds = entities[t].map((e) => e.id)
          return (
            <label className="cat-form-row" key={t}>
              <span>{ENTITY_LABELS[t].many}</span>
              <span className="cat-scope-row">
                <select
                  className="input cat-input"
                  value={scope.mode}
                  onChange={(e) => onChange({ categories: replace(setScopeMode(category, t, e.target.value as ScopeMode, allIds)) })}
                >
                  {(['none', 'all', 'selected'] as ScopeMode[]).map((m) => (
                    <option key={m} value={m}>
                      {SCOPE_LABELS[m]}
                    </option>
                  ))}
                </select>
                {scope.mode === 'selected' && (
                  <small>
                    on {scope.ids.length} {scope.ids.length === 1 ? ENTITY_LABELS[t].one : ENTITY_LABELS[t].many.toLowerCase()}
                  </small>
                )}
              </span>
            </label>
          )
        })}
        <div className="cat-hint">"Only selected" shows the category on the entries you add it to, from an entry's page or by selecting several in the list.</div>
      </div>
    </form>
  )
}
