import { useState } from 'react'
import type { Category, CategoryValue } from '@/core/model'
import { coerceValue } from './logic'

const EMPTY_LABEL = '—'

/** Edits one category value, with the right input for the category's kind (3.4). */
export function CategoryValueInput({
  category,
  value,
  onChange,
  id,
  ariaLabel,
}: {
  category: Category
  /** The raw stored value; converted for display. */
  value: CategoryValue | undefined
  onChange: (value: CategoryValue) => void
  id?: string
  ariaLabel?: string
}) {
  const current = coerceValue(category.kind, value, category.options)

  switch (category.kind) {
    case 'dropdown':
      return (
        <select id={id} aria-label={ariaLabel} className="input cat-input" value={current === null ? '' : String(current)} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">{EMPTY_LABEL}</option>
          {category.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    case 'boolean':
      return (
        <select
          id={id}
          aria-label={ariaLabel}
          className="input cat-input"
          value={current === null ? '' : current ? 'yes' : 'no'}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'yes')}
        >
          <option value="">{EMPTY_LABEL}</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      )
    case 'number':
      return <NumberInput id={id} ariaLabel={ariaLabel} value={current as number | null} onChange={onChange} />
    case 'text':
      return (
        <input
          id={id}
          aria-label={ariaLabel}
          className="input cat-input"
          value={current === null ? '' : String(current)}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        />
      )
  }
}

/** A number field that lets the user type "-" or "1." without losing it, and stores null when empty. */
export function NumberInput({
  value,
  onChange,
  id,
  className = 'input cat-input',
  ariaLabel,
}: {
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  className?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const [seen, setSeen] = useState(value)
  // Follow outside changes (undo, another panel) unless the text already means the same number.
  if (seen !== value) {
    setSeen(value)
    if (parse(text) !== value) setText(value === null ? '' : String(value))
  }
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      className={className}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parse(e.target.value)
        if (n !== undefined) onChange(n)
      }}
      onBlur={() => setText(value === null ? '' : String(value))}
    />
  )
}

/** undefined = not a number yet (keep typing); null = empty. */
function parse(text: string): number | null | undefined {
  const t = text.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}
