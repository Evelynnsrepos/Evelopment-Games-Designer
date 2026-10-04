import { Send } from 'lucide-react'
import { useState } from 'react'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore } from '@/core/state'
import { CANVAS_PRESETS, createSketchDoc, SketchEditor, type SketchDoc } from '@/shared/sketch'
import { IMAGE_TARGETS, sendImageTo } from '@/shell/editor/actions'
import './sketch-tool.css'

const UI = {
  newTitle: 'New drawing',
  newHint: 'Pick a canvas size. You can draw with a mouse or a pen tablet; pen pressure changes the line.',
  width: 'Width',
  height: 'Height',
  start: 'Start drawing',
  send: 'Send to…',
  sent: (to: string) => `Sent to ${to}`,
}

/** A sketch document; `started` is false until the canvas size is chosen. */
interface SketchToolDoc extends SketchDoc {
  started: boolean
}

const createDoc = (): SketchToolDoc => ({ ...createSketchDoc(), started: false })

/** Sketch (v0.5): a drawing tool with pressure brushes, layers, selection and mirror. */
export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<SketchToolDoc>('sketch', documentId!, createDoc)
  const title = useProjectStore((s) => s.meta?.documents.find((d) => d.id === documentId)?.title ?? 'Sketch')
  if (!doc.data) return null
  if (!doc.data.started) return <SizePicker onStart={(width, height) => doc.update((d) => ({ ...d, ...createSketchDoc(width, height), started: true }))} />
  return (
    <SketchEditor
      doc={doc.data}
      update={(fn) => doc.update((d) => ({ ...d, ...fn(d) }), { undoable: false })}
      active={active}
      title={title}
      actions={(flatten) => <SendMenu title={title} flatten={flatten} />}
    />
  )
}

function SizePicker({ onStart }: { onStart: (w: number, h: number) => void }) {
  const [w, setW] = useState(1920)
  const [h, setH] = useState(1080)
  const clamp = (v: number) => Math.max(16, Math.min(8192, Math.round(v) || 16))
  return (
    <div className="sketch-start">
      <h2>{UI.newTitle}</h2>
      <p className="muted">{UI.newHint}</p>
      <div className="sketch-start-presets">
        {CANVAS_PRESETS.map((p) => (
          <button
            key={p.label}
            className={`btn${p.width === w && p.height === h ? ' btn-primary' : ''}`}
            onClick={() => {
              setW(p.width)
              setH(p.height)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="sketch-start-size">
        <label>
          {UI.width}
          <input className="input" type="number" min={16} max={8192} value={w} onChange={(e) => setW(Number(e.target.value))} />
        </label>
        ×
        <label>
          {UI.height}
          <input className="input" type="number" min={16} max={8192} value={h} onChange={(e) => setH(Number(e.target.value))} />
        </label>
      </div>
      <button className="btn btn-primary" onClick={() => onStart(clamp(w), clamp(h))}>
        {UI.start}
      </button>
    </div>
  )
}

function SendMenu({ title, flatten }: { title: string; flatten: () => Promise<Blob> }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  return (
    <span className="sketch-send">
      <button className="btn btn-ghost sketch-send-btn" title={UI.send} onClick={() => setOpen(!open)}>
        <Send size={15} /> {UI.send}
      </button>
      {open && (
        <div className="menu" style={{ top: '100%', left: 0 }} onMouseLeave={() => setOpen(false)}>
          {IMAGE_TARGETS.map((t) => (
            <button
              key={t.type}
              onClick={async () => {
                setOpen(false)
                await sendImageTo(t.type, await flatten(), title)
                setNote(UI.sent(t.label))
                setTimeout(() => setNote(null), 3000)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {note && <span className="sketch-send-note">{note}</span>}
    </span>
  )
}
