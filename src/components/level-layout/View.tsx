import { Brush, Download, Eraser, PaintBucket, Square, StickyNote, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys } from '@/core/state'
import { saveBinaryFile, safeFileName } from '@/core/export'
import { NumberInput, PresetHeader } from '@/shared/calculators'
import { bucket, cellKey, counts, createLevelDoc, MARKERS, newNote, room, tileColor, TILES, type LevelDoc, type TileId } from './model'
import './level-layout.css'

type Tool = 'paint' | 'erase' | 'room' | 'fill' | 'note'
const CELL = 22

/** Level / dungeon layout editor (v0.10). */
export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<LevelDoc>('level-layout', documentId!, createLevelDoc)
  useUndoRedoKeys(doc, active)
  const title = useProjectStore((s) => s.meta?.documents.find((x) => x.id === documentId)?.title ?? 'Level')
  const [tool, setTool] = useState<Tool>('paint')
  const [tile, setTile] = useState<TileId>('wall')
  const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState<{ x: number; y: number; tiles: Record<string, TileId> } | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const d = doc.data
  const shown = useMemo(() => (drag && d ? { ...d, tiles: drag.tiles } : d), [drag, d])

  useEffect(() => {
    const c = canvas.current
    if (!c || !shown) return
    const ctx = c.getContext('2d')!
    const s = CELL
    c.width = shown.width * s
    c.height = shown.height * s
    ctx.fillStyle = '#1b1b20'
    ctx.fillRect(0, 0, c.width, c.height)
    for (const [k, t] of Object.entries(shown.tiles)) {
      const [x, y] = k.split(',').map(Number)
      const mark = MARKERS[t]
      ctx.fillStyle = mark ? tileColor('floor') : tileColor(t)
      ctx.fillRect(x * s, y * s, s, s)
      if (mark) {
        ctx.fillStyle = tileColor(t)
        ctx.beginPath()
        ctx.arc(x * s + s / 2, y * s + s / 2, s * 0.38, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.round(s * 0.5)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(mark, x * s + s / 2, y * s + s / 2 + 1)
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    for (let x = 0; x <= shown.width; x++) {
      ctx.beginPath()
      ctx.moveTo(x * s + 0.5, 0)
      ctx.lineTo(x * s + 0.5, c.height)
      ctx.stroke()
    }
    for (let y = 0; y <= shown.height; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * s + 0.5)
      ctx.lineTo(c.width, y * s + 0.5)
      ctx.stroke()
    }
    shown.notes.forEach((n, i) => {
      ctx.fillStyle = '#ffe27a'
      ctx.fillRect(n.x * s + 2, n.y * s + 2, s - 4, s - 4)
      ctx.fillStyle = '#1c1d22'
      ctx.font = `bold ${Math.round(s * 0.5)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), n.x * s + s / 2, n.y * s + s / 2 + 1)
    })
  }, [shown])

  if (!d) return null
  const cellAt = (e: React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: Math.floor(((e.clientX - r.left) / r.width) * d.width), y: Math.floor(((e.clientY - r.top) / r.height) * d.height) }
  }
  const inside = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x < d.width && p.y < d.height
  const apply = (tiles: Record<string, TileId>) => doc.update((x) => ({ ...x, tiles }))
  const paintAt = (tiles: Record<string, TileId>, p: { x: number; y: number }) => {
    const next = { ...tiles }
    if (tool === 'erase') delete next[cellKey(p.x, p.y)]
    else next[cellKey(p.x, p.y)] = tile
    return next
  }

  const onDown = (e: React.MouseEvent) => {
    const p = cellAt(e)
    if (!inside(p)) return
    if (tool === 'fill') return apply(bucket(d, p.x, p.y, e.button === 2 ? null : tile))
    if (tool === 'note') {
      const hit = d.notes.find((n) => n.x === p.x && n.y === p.y)
      if (hit) return setNoteId(hit.id)
      const n = newNote(p.x, p.y)
      doc.update((x) => ({ ...x, notes: [...x.notes, n] }))
      return setNoteId(n.id)
    }
    setDrag({ x: p.x, y: p.y, tiles: tool === 'room' ? d.tiles : paintAt(d.tiles, p) })
  }
  const onMove = (e: React.MouseEvent) => {
    const p = cellAt(e)
    setHover(inside(p) ? p : null)
    if (!drag || !inside(p)) return
    if (tool === 'room') setDrag({ ...drag, tiles: room(d, drag.x, drag.y, p.x, p.y) })
    else setDrag({ ...drag, tiles: paintAt(drag.tiles, p) })
  }
  const onUp = () => {
    if (drag) apply(drag.tiles)
    setDrag(null)
  }

  const exportPng = async () => {
    const blob = await new Promise<Blob | null>((res) => canvas.current!.toBlob(res, 'image/png'))
    if (blob) await saveBinaryFile({ title: 'Export level as PNG', defaultName: `${safeFileName(title)}.png`, bytes: new Uint8Array(await blob.arrayBuffer()), filter: { name: 'PNG image', extensions: ['png'] } })
  }

  const note = d.notes.find((n) => n.id === noteId)
  const tally = counts(d)
  const tools: { id: Tool; icon: typeof Brush; label: string }[] = [
    { id: 'paint', icon: Brush, label: 'Paint' },
    { id: 'room', icon: Square, label: 'Room (drag)' },
    { id: 'fill', icon: PaintBucket, label: 'Fill' },
    { id: 'erase', icon: Eraser, label: 'Erase' },
    { id: 'note', icon: StickyNote, label: 'Note' },
  ]

  return (
    <div className="lv">
      <div className="lv-head">
        <PresetHeader documentId={documentId!} kind="Level" undo={doc.undo} redo={doc.redo} canUndo={doc.canUndo} canRedo={doc.canRedo} />
      </div>
      <div className="lv-toolbar">
        {tools.map((t) => (
          <button key={t.id} className={`icon-btn${tool === t.id ? ' on' : ''}`} title={t.label} aria-label={t.label} onClick={() => setTool(t.id)}>
            <t.icon size={16} />
          </button>
        ))}
        <span className="lv-sep" />
        <label className="ld-inline">
          Size
          <NumberInput value={d.width} min={4} max={200} onChange={(v) => doc.update((x) => ({ ...x, width: Math.max(4, Math.min(200, Math.round(v))) }))} />×
          <NumberInput value={d.height} min={4} max={200} onChange={(v) => doc.update((x) => ({ ...x, height: Math.max(4, Math.min(200, Math.round(v))) }))} />
        </label>
        <label className="ld-inline">
          Zoom
          <input type="range" min={0.5} max={2.5} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        <button className="btn btn-ghost lv-btn" onClick={() => void exportPng()}>
          <Download size={14} /> PNG
        </button>
        <span className="lv-hover">{hover ? `${hover.x}, ${hover.y}` : ''}</span>
      </div>
      <div className="lv-body">
        <div className="lv-palette">
          {TILES.map((t) => (
            <button key={t.id} className={`lv-tile${tile === t.id ? ' on' : ''}`} onClick={() => (setTile(t.id), tool === 'erase' || tool === 'note' ? setTool('paint') : null)}>
              <span style={{ background: t.color }}>{MARKERS[t.id]}</span>
              {t.label}
              {tally[t.id] ? <em>{tally[t.id]}</em> : null}
            </button>
          ))}
        </div>
        <div className="lv-canvas">
          <canvas
            ref={canvas}
            style={{ width: d.width * CELL * zoom, height: d.height * CELL * zoom }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={() => (onUp(), setHover(null))}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
        <aside className="lv-notes">
          <strong>Notes</strong>
          {d.notes.length === 0 && <p className="muted">Use the Note tool to pin numbered notes on the map: a puzzle, a secret, an ambush.</p>}
          {d.notes.map((n, i) => (
            <div key={n.id} className={`lv-note${n.id === noteId ? ' on' : ''}`} onClick={() => setNoteId(n.id)}>
              <span className="lv-num">{i + 1}</span>
              {n.id === noteId ? (
                <textarea
                  className="input"
                  autoFocus
                  rows={3}
                  value={n.text}
                  onChange={(e) => doc.update((x) => ({ ...x, notes: x.notes.map((o) => (o.id === n.id ? { ...o, text: e.target.value } : o)) }))}
                />
              ) : (
                <span className="lv-text">{n.text || 'Empty note'}</span>
              )}
              <button className="icon-btn" aria-label="Delete note" onClick={() => doc.update((x) => ({ ...x, notes: x.notes.filter((o) => o.id !== n.id) }))}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {note && <span className="muted">Note at {note.x}, {note.y}</span>}
        </aside>
      </div>
    </div>
  )
}
