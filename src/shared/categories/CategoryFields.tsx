import { Plus, Settings2, X } from 'lucide-react'
import { useState } from 'react'
import type { Category, CategoryValue, EntityBase, EntityType, Id } from '@/core/model'
import { NewCategoryForm } from './CategoryForm'
import { CategoryValueInput } from './CategoryValueInput'
import { applyToEntity, availableToAdd, categoriesFor, ENTITY_LABELS, removeFromEntity } from './logic'
import './categories.css'

const NEW_CATEGORY = '__new__'

export interface CategoryFieldsProps {
  type: EntityType
  entity: EntityBase
  /** Ids of every entity of this type, needed when "all" turns into "selected". */
  allIds: Id[]
  categories: Category[]
  onValueChange(categoryId: Id, value: CategoryValue): void
  onCategoriesChange(next: Category[]): void
  /** Opens the full category manager; the gear button is hidden without it. */
  onManage?(): void
}

/**
 * The category/association fields of one entity (IT-3..IT-6, CH-2, CH-3, EN-2):
 * edit values, hide a category on this entity, or add any project category to it.
 */
export function CategoryFields({ type, entity, allIds, categories, onValueChange, onCategoriesChange, onManage }: CategoryFieldsProps) {
  const [creating, setCreating] = useState(false)
  const shown = categoriesFor(categories, type, entity.id)
  const available = availableToAdd(categories, type, entity.id)
  const label = ENTITY_LABELS[type].one

  const replace = (c: Category) => onCategoriesChange(categories.map((x) => (x.id === c.id ? c : x)))

  return (
    <div className="cat-fields">
      {shown.length === 0 && <div className="cat-empty">No categories on this {label} yet.</div>}
      {shown.map((c) => {
        const inputId = `cat-${entity.id}-${c.id}`
        return (
          <div className="cat-field" key={c.id}>
            <label htmlFor={inputId}>{c.name}</label>
            <CategoryValueInput id={inputId} category={c} value={entity.categories[c.id]} onChange={(v) => onValueChange(c.id, v)} />
            <button
              className="icon-btn"
              title={`Remove "${c.name}" from this ${label}`}
              aria-label={`Remove ${c.name} from this ${label}`}
              onClick={() => replace(removeFromEntity(c, type, entity.id, allIds))}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}

      {creating ? (
        <NewCategoryForm
          type={type}
          categories={categories}
          defaultScope="this"
          onCancel={() => setCreating(false)}
          onUseExisting={(c) => {
            setCreating(false)
            replace(applyToEntity(c, type, entity.id))
          }}
          onCreate={(c) => {
            setCreating(false)
            const scoped = c.appliesTo[type]?.mode === 'selected' ? applyToEntity(c, type, entity.id) : c
            onCategoriesChange([...categories, scoped])
          }}
        />
      ) : (
        <div className="cat-add-row">
          <Plus size={14} aria-hidden />
          <select
            className="input cat-input"
            aria-label={`Add a category to this ${label}`}
            value=""
            onChange={(e) => {
              const id = e.target.value
              if (id === NEW_CATEGORY) return setCreating(true)
              const c = categories.find((x) => x.id === id)
              if (c) replace(applyToEntity(c, type, entity.id))
            }}
          >
            <option value="">Add category…</option>
            {available.length > 0 && (
              <optgroup label="Existing categories">
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={NEW_CATEGORY}>New category…</option>
          </select>
          {onManage && (
            <button className="icon-btn" title="Manage categories" aria-label="Manage categories" onClick={onManage}>
              <Settings2 size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
