import { Copy, FolderPlus, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Id } from '@/core/model'
import { confirmDialog, promptDialog } from '../dialogs'
import { drawPreview, type BrushDef } from './brushes'
import { BrushStudio } from './BrushStudio'
import { useBrushLibrary } from './library'

const UI = {
  title: 'Brush Library',
  recent: 'Recent',
  newSet: 'New brush set',
  newSetName: 'Name the brush set',
  newBrush: 'New brush',
  rename: 'Rename',
  renameSet: 'Rename brush set',
  deleteSet: 'Delete brush set',
  deleteSetText: 'Brushes that are only in this set are deleted too.',
  edit: 'Edit in Brush Studio',
  duplicate: 'Duplicate',
  reset: 'Reset to the original settings',
  deleteBrush: 'Delete brush',
  renameBrush: 'Rename brush',
  drag: 'Drag a brush onto a set on the left to move it there.',
  emptySet: 'No brushes in this set yet. Make one with +, or drag a brush here.',
}

const DRAG = 'application/x-egd-brush'

/** Brush library popover: sets on the left, brushes with stroke previews on the right (like Procreate). */
export function BrushLibrary({ mode, color, at, onClose }: { mode: 'brush' | 'eraser'; color: string; at: { x: number; y: number }; onClose: () => void }) {
  const lib = useBrushLibrary()
  const current = mode === 'brush' ? lib.brushId : lib.eraserId
  const [setId, setSetId] = useState<Id>(() => (lib.recent.length ? 'recent' : (lib.sets.find((s) => s.brushIds.includes(current))?.id ?? lib.sets[0]?.id ?? 'recent')))
  const [editing, setEditing] = useState<Id | null>(null)
  const [dropSet, setDropSet] = useState<Id | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking outside (but not while Brush Studio or a dialog is open).
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (editing || document.querySelector('.modal-backdrop')) return
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', down)
    return () => window.removeEventListener('mousedown', down)
  }, [editing, onClose])

  const byId = new Map(lib.brushes.map((b) => [b.id, b]))
  const ids = setId === 'recent' ? lib.recent : (lib.sets.find((s) => s.id === setId)?.brushIds ?? [])
  const shown = ids.map((id) => byId.get(id)).filter((b): b is BrushDef => !!b)
  const realSet = setId !== 'recent' ? setId : (lib.sets.find((s) => s.brushIds.includes(current))?.id ?? lib.sets[0]?.id)

  const newSet = async () => {
    const name = (await promptDialog(UI.newSetName, 'My brushes'))?.trim()
    if (name) setSetId(lib.createSet(name))
  }

  return (
    <div className="brushlib" ref={ref} style={{ left: at.x, top: at.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="brushlib-head">
        <h4>{UI.title}</h4>
        <button className="icon-btn" title={UI.newSet} onClick={() => void newSet()}>
          <FolderPlus size={15} />
        </button>
        {realSet && (
          <button
            className="icon-btn"
            title={UI.newBrush}
            onClick={() => {
              const id = lib.createBrush(realSet)
              setSetId(realSet)
              setEditing(id)
            }}
          >
            <Plus size={15} />
          </button>
        )}
      </div>
      <div className="brushlib-body">
        <nav className="brushlib-sets">
          {lib.recent.length > 0 && (
            <button className={`brushlib-set${setId === 'recent' ? ' is-active' : ''}`} onClick={() => setSetId('recent')}>
              {UI.recent}
            </button>
          )}
          {lib.sets.map((s) => (
            <button
              key={s.id}
              className={`brushlib-set${setId === s.id ? ' is-active' : ''}${dropSet === s.id ? ' is-drop' : ''}`}
              onClick={() => setSetId(s.id)}
              onDoubleClick={async () => {
                const name = (await promptDialog(UI.renameSet, s.name))?.trim()
                if (name) lib.renameSet(s.id, name)
              }}
              onContextMenu={async (e) => {
                e.preventDefault()
                if (await confirmDialog({ title: `${UI.deleteSet}: ${s.name}?`, message: UI.deleteSetText, confirmLabel: UI.deleteSet, danger: true })) {
                  lib.deleteSet(s.id)
                  setSetId(lib.sets[0]?.id ?? 'recent')
                }
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG)) return
                e.preventDefault()
                setDropSet(s.id)
              }}
              onDragLeave={() => setDropSet(null)}
              onDrop={(e) => {
                setDropSet(null)
                const id = e.dataTransfer.getData(DRAG)
                if (id) lib.moveBrush(id, s.id)
              }}
              title="Double-click to rename, right-click to delete"
            >
              {s.name}
            </button>
          ))}
        </nav>
        <div className="brushlib-brushes">
          {shown.length === 0 && <p className="muted brushlib-empty">{UI.emptySet}</p>}
          {shown.map((b) => (
            <BrushRow
              key={b.id}
              brush={b}
              color={mode === 'eraser' ? '#888' : color}
              active={b.id === current}
              onPick={() => lib.select(b.id, mode)}
              onEdit={() => setEditing(b.id)}
              onDuplicate={() => realSet && lib.duplicateBrush(b.id, realSet)}
              onDelete={async () => {
                if (await confirmDialog({ title: `${UI.deleteBrush}: ${b.name}?`, message: 'This cannot be undone.', confirmLabel: UI.deleteBrush, danger: true })) lib.deleteBrush(b.id)
              }}
              onRename={async () => {
                const name = (await promptDialog(UI.renameBrush, b.name))?.trim()
                if (name) lib.updateBrush(b.id, { name })
              }}
              onDropBefore={(id) => setId !== 'recent' && lib.moveBrush(id, setId, b.id)}
            />
          ))}
          <p className="muted brushlib-hint">{UI.drag}</p>
        </div>
      </div>
      {editing && <BrushStudio brushId={editing} color={color} onClose={() => setEditing(null)} />}
    </div>
  )
}

function BrushRow(p: {
  brush: BrushDef
  color: string
  active: boolean
  onPick(): void
  onEdit(): void
  onDuplicate(): void
  onDelete(): void
  onRename(): void
  onDropBefore(id: Id): void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) drawPreview(canvas.current, p.brush, p.color)
  }, [p.brush, p.color])
  return (
    <div
      className={`brushlib-brush${p.active ? ' is-active' : ''}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DRAG, p.brush.id)}
      onDragOver={(e) => e.dataTransfer.types.includes(DRAG) && e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(DRAG)
        if (id && id !== p.brush.id) p.onDropBefore(id)
      }}
      onClick={p.onPick}
      onDoubleClick={p.onEdit}
    >
      <div className="brushlib-brush-name">{p.brush.name}</div>
      <canvas ref={canvas} width={220} height={54} className="brushlib-preview" />
      <div className="brushlib-brush-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title={UI.edit} onClick={p.onEdit}>
          <SlidersHorizontal size={13} />
        </button>
        <button className="icon-btn" title={UI.rename} onClick={p.onRename}>
          <Pencil size={13} />
        </button>
        <button className="icon-btn" title={UI.duplicate} onClick={p.onDuplicate}>
          <Copy size={13} />
        </button>
        {p.brush.builtIn && (
          <button className="icon-btn" title={UI.reset} onClick={() => useBrushLibrary.getState().resetBrush(p.brush.id)}>
            <RotateCcw size={13} />
          </button>
        )}
        <button className="icon-btn" title={UI.deleteBrush} onClick={p.onDelete}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
