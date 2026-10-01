import { Plus } from 'lucide-react'
import type { RefItem } from './types'

export type RefMenuEntry = { type: 'ref'; item: RefItem } | { type: 'create'; label: string; text: string }

export interface RefMenuProps {
  entries: RefMenuEntry[]
  query: string
  selected: number
  onPick: (index: number) => void
}

const UI = {
  empty: 'No matches. Keep typing a name.',
  hint: 'Link to an entity or article',
}

export function RefMenu({ entries, query, selected, onPick }: RefMenuProps) {
  return (
    <div className="richtext-refmenu" role="listbox" aria-label={UI.hint}>
      {entries.length === 0 && <div className="richtext-refmenu-empty">{query ? UI.empty : UI.hint}</div>}
      {entries.map((entry, i) => (
        <button
          key={entry.type === 'ref' ? `${entry.item.kind}:${entry.item.id}` : 'create'}
          type="button"
          role="option"
          aria-selected={i === selected}
          className={i === selected ? 'richtext-refmenu-item is-selected' : 'richtext-refmenu-item'}
          // mousedown keeps focus (and the suggestion) in the editor
          onMouseDown={(e) => {
            e.preventDefault()
            onPick(i)
          }}
        >
          {entry.type === 'ref' ? (
            <>
              <span className="richtext-refmenu-label">{entry.item.label}</span>
              {entry.item.hint && <span className="richtext-refmenu-hint">{entry.item.hint}</span>}
            </>
          ) : (
            <span className="richtext-refmenu-label">
              <Plus size={13} /> {entry.text}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
