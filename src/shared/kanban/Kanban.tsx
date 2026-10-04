import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import './kanban.css'

export interface KanbanColumn {
  id: string
  title: string
  color?: string
  /** Shown next to the title, e.g. a total. */
  extra?: string
}

/**
 * Columns of cards that can be dragged between columns and reordered
 * (v0.10, scope planner and task board).
 */
export function Kanban<T extends { id: string }>({
  columns,
  cards,
  columnOf,
  renderCard,
  onMove,
  onAdd,
  onOpen,
  selectedId,
}: {
  columns: KanbanColumn[]
  cards: T[]
  columnOf(card: T): string
  renderCard(card: T): ReactNode
  /** Move a card to a column, before another card (or to the end). */
  onMove(id: string, column: string, beforeId: string | null): void
  onAdd(column: string): void
  onOpen(id: string): void
  selectedId?: string | null
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<{ column: string; before: string | null } | null>(null)
  const drop = () => {
    if (dragging && over) onMove(dragging, over.column, over.before)
    setDragging(null)
    setOver(null)
  }
  return (
    <div className="kb">
      {columns.map((col) => {
        const list = cards.filter((c) => columnOf(c) === col.id)
        return (
          <section
            key={col.id}
            className={`kb-col${over?.column === col.id ? ' over' : ''}`}
            onDragOver={(e) => {
              if (!dragging) return
              e.preventDefault()
              if (over?.column !== col.id || over.before !== null) {
                if (e.target === e.currentTarget) setOver({ column: col.id, before: null })
              }
            }}
            onDrop={drop}
          >
            <header style={col.color ? { borderColor: col.color } : undefined}>
              <span>{col.title}</span>
              <span className="kb-count">{col.extra ?? list.length}</span>
              <button className="icon-btn" title="Add" aria-label={`Add to ${col.title}`} onClick={() => onAdd(col.id)}>
                <Plus size={14} />
              </button>
            </header>
            <div className="kb-cards" onDragOver={(e) => dragging && e.target === e.currentTarget && (e.preventDefault(), setOver({ column: col.id, before: null }))}>
              {list.map((c) => (
                <div
                  key={c.id}
                  className={`kb-card${selectedId === c.id ? ' on' : ''}${dragging === c.id ? ' dragging' : ''}${over?.before === c.id ? ' before' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', c.id)
                    setDragging(c.id)
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                  onDragOver={(e) => {
                    if (!dragging || dragging === c.id) return
                    e.preventDefault()
                    e.stopPropagation()
                    setOver({ column: col.id, before: c.id })
                  }}
                  onDrop={(e) => {
                    e.stopPropagation()
                    drop()
                  }}
                  onClick={() => onOpen(c.id)}
                >
                  {renderCard(c)}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
