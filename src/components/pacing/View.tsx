import { Plus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { newId } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useUndoRedoKeys } from '@/core/state'
import { NumberInput, PresetHeader } from '@/shared/calculators'
import '@/shared/listDetail/listDetail.css'
import { BEAT_KINDS, createPacingDoc, newBeat, pacingNotes, type Beat, type BeatKind, type PacingDoc } from './model'
import './pacing.css'

const W = 900
const H = 300
const PAD = { l: 40, r: 20, t: 20, b: 50 }

/** Pacing / player journey graph (v0.10). Drag points up and down to set a beat's value. */
export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<PacingDoc>('pacing', documentId!, createPacingDoc)
  useUndoRedoKeys(doc, active)
  const [sel, setSel] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ beat: string; curve: string; value: number } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  if (!doc.data) return null
  const d = doc.data
  const set = (fn: (d: PacingDoc) => PacingDoc) => doc.update(fn)
  const editBeat = (id: string, patch: Partial<Beat>) => set((x) => ({ ...x, beats: x.beats.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
  const beats = [...d.beats].sort((a, b) => a.at - b.at)
  const max = Math.max(10, ...beats.map((b) => b.at))
  const x = (at: number) => PAD.l + (at / max) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - v / 10) * (H - PAD.t - PAD.b)
  const valueAt = (clientY: number) => {
    const r = svg.current!.getBoundingClientRect()
    const py = ((clientY - r.top) / r.height) * H
    return Math.max(0, Math.min(10, Math.round((1 - (py - PAD.t) / (H - PAD.t - PAD.b)) * 20) / 2))
  }
  const val = (b: Beat, curve: string) => (drag && drag.beat === b.id && drag.curve === curve ? drag.value : (b.values[curve] ?? 0))
  const beat = d.beats.find((b) => b.id === sel)
  const notes = d.curves.flatMap((c) => pacingNotes(d.beats, c))

  return (
    <div className="pc">
      <div className="pc-head">
        <PresetHeader documentId={documentId!} kind="Pacing" undo={doc.undo} redo={doc.redo} canUndo={doc.canUndo} canRedo={doc.canRedo} />
      </div>
      <div className="ld-toolbar">
        <button
          className="btn btn-primary"
          onClick={() => {
            const n = newBeat((beats.at(-1)?.at ?? 0) + 10, d.curves)
            set((x) => ({ ...x, beats: [...x.beats, n] }))
            setSel(n.id)
          }}
        >
          <Plus size={14} /> Add beat
        </button>
        {d.curves.map((c) => (
          <span key={c.id} className="pc-curve">
            <input type="color" value={c.color} onChange={(e) => set((x) => ({ ...x, curves: x.curves.map((o) => (o.id === c.id ? { ...o, color: e.target.value } : o)) }))} aria-label="Curve color" />
            <input className="input" value={c.name} onChange={(e) => set((x) => ({ ...x, curves: x.curves.map((o) => (o.id === c.id ? { ...o, name: e.target.value } : o)) }))} />
            {d.curves.length > 1 && (
              <button className="icon-btn" aria-label="Remove curve" onClick={() => set((x) => ({ ...x, curves: x.curves.filter((o) => o.id !== c.id) }))}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        <button className="btn btn-ghost" onClick={() => set((x) => ({ ...x, curves: [...x.curves, { id: newId(), name: 'Difficulty', color: '#3e8ef7' }] }))}>
          <Plus size={14} /> Curve
        </button>
        <label className="ld-inline">
          Unit
          <input className="input" style={{ width: 70 }} value={d.unit} onChange={(e) => set((x) => ({ ...x, unit: e.target.value }))} />
        </label>
      </div>
      <div className="pc-body">
        <div className="pc-main">
          <svg
            ref={svg}
            className="pc-chart"
            viewBox={`0 0 ${W} ${H}`}
            onMouseMove={(e) => drag && setDrag({ ...drag, value: valueAt(e.clientY) })}
            onMouseUp={() => {
              if (drag) {
                const b = d.beats.find((o) => o.id === drag.beat)
                if (b) editBeat(b.id, { values: { ...b.values, [drag.curve]: drag.value } })
              }
              setDrag(null)
            }}
            onMouseLeave={() => setDrag(null)}
          >
            {[0, 2.5, 5, 7.5, 10].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="pc-grid" />
                <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="pc-axis">
                  {v}
                </text>
              </g>
            ))}
            {beats.map((b) => (
              <g key={b.id}>
                <line x1={x(b.at)} x2={x(b.at)} y1={PAD.t} y2={H - PAD.b} className={`pc-beatline${sel === b.id ? ' on' : ''}`} />
                <text x={x(b.at)} y={H - PAD.b + 16} textAnchor="middle" className="pc-axis" onClick={() => setSel(b.id)}>
                  {b.name.slice(0, 14)}
                </text>
                <text x={x(b.at)} y={H - PAD.b + 30} textAnchor="middle" className="pc-axis muted">
                  {b.at} {d.unit}
                </text>
              </g>
            ))}
            {d.curves.map((c) => (
              <g key={c.id}>
                <polyline fill="none" stroke={c.color} strokeWidth={3} strokeLinejoin="round" points={beats.map((b) => `${x(b.at)},${y(val(b, c.id))}`).join(' ')} />
                {beats.map((b) => (
                  <circle
                    key={b.id}
                    cx={x(b.at)}
                    cy={y(val(b, c.id))}
                    r={sel === b.id ? 8 : 6}
                    fill={c.color}
                    stroke="var(--bg)"
                    strokeWidth={2}
                    className="pc-point"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setSel(b.id)
                      setDrag({ beat: b.id, curve: c.id, value: b.values[c.id] ?? 0 })
                    }}
                  >
                    <title>{`${b.name}: ${c.name} ${b.values[c.id] ?? 0}`}</title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>
          {notes.length > 0 && (
            <div className="pc-notes">
              {notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          )}
          <div className="pc-strip">
            {beats.map((b) => (
              <button key={b.id} className={`pc-card${sel === b.id ? ' on' : ''}`} onClick={() => setSel(b.id)}>
                <strong>{b.name}</strong>
                <span>
                  {b.kind}
                  {b.emotion ? ` · ${b.emotion}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
        {beat && (
          <aside className="pc-side">
            <div className="ld-inline">
              <input className="input" style={{ flex: 1, fontWeight: 600 }} value={beat.name} onChange={(e) => editBeat(beat.id, { name: e.target.value })} aria-label="Beat name" />
              <button className="icon-btn" aria-label="Close" onClick={() => setSel(null)}>
                <X size={14} />
              </button>
            </div>
            <label className="ld-field">
              <span>Kind</span>
              <select className="input" value={beat.kind} onChange={(e) => editBeat(beat.id, { kind: e.target.value as BeatKind })}>
                {BEAT_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="ld-field">
              <span>At ({d.unit})</span>
              <NumberInput value={beat.at} min={0} onChange={(at) => editBeat(beat.id, { at })} />
            </label>
            {d.curves.map((c) => (
              <label key={c.id} className="ld-field">
                <span style={{ color: c.color }}>
                  {c.name}: {beat.values[c.id] ?? 0}
                </span>
                <input type="range" min={0} max={10} step={0.5} value={beat.values[c.id] ?? 0} onChange={(e) => editBeat(beat.id, { values: { ...beat.values, [c.id]: Number(e.target.value) } })} />
              </label>
            ))}
            <label className="ld-field">
              <span>How the player should feel</span>
              <input className="input" placeholder="Tense, relieved, awed…" value={beat.emotion} onChange={(e) => editBeat(beat.id, { emotion: e.target.value })} />
            </label>
            <label className="ld-field">
              <span>Notes</span>
              <textarea className="input" rows={4} value={beat.notes} onChange={(e) => editBeat(beat.id, { notes: e.target.value })} />
            </label>
            <button
              className="btn btn-danger ld-danger"
              onClick={() => {
                set((x) => ({ ...x, beats: x.beats.filter((o) => o.id !== beat.id) }))
                setSel(null)
              }}
            >
              <Trash2 size={14} /> Delete beat
            </button>
          </aside>
        )}
      </div>
    </div>
  )
}
