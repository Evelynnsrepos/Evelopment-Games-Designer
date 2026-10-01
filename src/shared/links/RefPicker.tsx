import { useMemo, useState } from 'react'
import type { RefItem, RefProvider } from '@/shared/richtext'
import './links.css'

const UI = {
  placeholder: 'Search characters, towns, items...',
  empty: 'No matches.',
}

export interface RefPickerProps {
  provider: RefProvider
  onPick(item: RefItem): void
  /** Hide items already chosen. */
  exclude?: { kind: string; id: string }[]
  placeholder?: string
  autoFocus?: boolean
}

/**
 * Search box over a `RefProvider` (entities, wiki articles) for picking a link
 * target in a form, e.g. a story node's or timeline event's link (SW-2, TL-9).
 * Arrows move, Enter picks, Esc clears.
 */
export function RefPicker({ provider, onPick, exclude = [], placeholder = UI.placeholder, autoFocus }: RefPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(0)
  const results = useMemo(() => {
    const skip = new Set(exclude.map((t) => `${t.kind}:${t.id}`))
    return provider.search(query).filter((r) => !skip.has(`${r.kind}:${r.id}`))
  }, [provider, query, exclude])

  const pick = (item: RefItem | undefined) => {
    if (!item) return
    onPick(item)
    setQuery('')
    setSelected(0)
  }

  return (
    <div className="ref-picker">
      <input
        className="input ref-picker-input"
        value={query}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value)
          setSelected(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setSelected((i) => Math.min(i + 1, results.length - 1))
          else if (e.key === 'ArrowUp') setSelected((i) => Math.max(i - 1, 0))
          else if (e.key === 'Enter') pick(results[selected])
          else if (e.key === 'Escape') {
            e.preventDefault() // keep Esc from toggling Layout Mode (ED-7)
            if (query) setQuery('')
            else e.currentTarget.blur()
          } else return
          e.preventDefault()
          e.stopPropagation()
        }}
      />
      {open && (
        <div className="ref-picker-menu" role="listbox">
          {results.length === 0 && <div className="ref-picker-empty">{UI.empty}</div>}
          {results.map((r, i) => (
            <button
              key={`${r.kind}:${r.id}`}
              type="button"
              role="option"
              aria-selected={i === selected}
              className={'ref-picker-item' + (i === selected ? ' is-selected' : '')}
              // mousedown keeps focus in the input until the pick is done
              onMouseDown={(e) => {
                e.preventDefault()
                pick(r)
              }}
            >
              <span className="ref-picker-label">{r.label}</span>
              {r.hint && <span className="ref-picker-hint">{r.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
