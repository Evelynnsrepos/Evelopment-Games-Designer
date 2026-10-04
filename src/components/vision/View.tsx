import { Plus, X } from 'lucide-react'
import { newId, type Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useUndoRedoKeys } from '@/core/state'
import { ProofTextarea } from '@/shared/spell'
import './vision.css'

/** Design pillars & vision (v0.10): the one page that says what the game is and is not. */

interface Pillar {
  id: Id
  title: string
  why: string
  /** Things that fit this pillar. */
  yes: string
  /** Things it rules out. */
  no: string
  color: string
}

interface Reference {
  id: Id
  name: string
  takeaway: string
}

export interface VisionDoc {
  pitch: string
  vision: string
  fantasy: string
  genre: string
  platforms: string
  audience: string
  usps: string[]
  pillars: Pillar[]
  references: Reference[]
  antiGoals: string
}

const COLORS = ['#f5a623', '#3e8ef7', '#2f9e44', '#c2255c', '#9c36b5']
const newPillar = (n: number): Pillar => ({ id: newId(), title: '', why: '', yes: '', no: '', color: COLORS[n % COLORS.length] })

const createVisionDoc = (): VisionDoc => ({
  pitch: '',
  vision: '',
  fantasy: '',
  genre: '',
  platforms: '',
  audience: '',
  usps: [''],
  pillars: [newPillar(0), newPillar(1), newPillar(2)],
  references: [],
  antiGoals: '',
})

export default function View({ active }: PanelProps) {
  const doc = useDocument<VisionDoc>('vision', 'vision', createVisionDoc)
  useUndoRedoKeys(doc, active)
  if (!doc.data) return null
  // Other tools read this document too (pillars), so fill in anything missing.
  const d = { ...createVisionDoc(), ...doc.data }
  const set = (patch: Partial<VisionDoc>) => doc.update((x) => ({ ...x, ...patch }))
  const editPillar = (id: Id, patch: Partial<Pillar>) => set({ pillars: d.pillars.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const text = (key: 'pitch' | 'vision' | 'fantasy' | 'antiGoals', label: string, hint: string, rows = 2) => (
    <label className="vi-field">
      <span>{label}</span>
      <ProofTextarea className="input" rows={rows} placeholder={hint} value={d[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  )
  const line = (key: 'genre' | 'platforms' | 'audience', label: string, hint: string) => (
    <label className="vi-field">
      <span>{label}</span>
      <input className="input" placeholder={hint} value={d[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  )

  return (
    <div className="vi">
      <div className="vi-page">
        <h2>Vision</h2>
        {text('pitch', 'Elevator pitch', 'One or two sentences: "A cozy farming game where you rebuild a village of retired monsters."')}
        {text('vision', 'Vision statement', 'What the finished game is and why it matters.', 3)}
        {text('fantasy', 'Player fantasy', 'Who does the player get to be? How should they feel?')}
        <div className="vi-row">
          {line('genre', 'Genre', 'Action RPG, roguelite…')}
          {line('platforms', 'Platforms', 'PC, Switch…')}
          {line('audience', 'Target audience', 'Who is it for?')}
        </div>

        <h2>What makes it special</h2>
        {d.usps.map((u, i) => (
          <div key={i} className="vi-usp">
            <span>{i + 1}</span>
            <input className="input" placeholder="A unique selling point" value={u} onChange={(e) => set({ usps: d.usps.map((x, j) => (j === i ? e.target.value : x)) })} />
            <button className="icon-btn" aria-label="Remove" onClick={() => set({ usps: d.usps.filter((_, j) => j !== i) })}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button className="btn btn-ghost vi-add" onClick={() => set({ usps: [...d.usps, ''] })}>
          <Plus size={14} /> Add selling point
        </button>

        <h2>Design pillars</h2>
        <p className="muted">Three to five rules every feature must serve. When you are unsure about an idea, ask which pillar it supports; if none, cut it.</p>
        <div className="vi-pillars">
          {d.pillars.map((p) => (
            <div key={p.id} className="vi-pillar" style={{ borderTopColor: p.color }}>
              <div className="vi-pillar-head">
                <input type="color" value={p.color} onChange={(e) => editPillar(p.id, { color: e.target.value })} aria-label="Color" />
                <input className="input vi-pillar-title" placeholder="e.g. Every fight is a puzzle" value={p.title} onChange={(e) => editPillar(p.id, { title: e.target.value })} />
                <button className="icon-btn" aria-label="Remove pillar" onClick={() => set({ pillars: d.pillars.filter((x) => x.id !== p.id) })}>
                  <X size={13} />
                </button>
              </div>
              <ProofTextarea className="input" rows={2} placeholder="Why it matters" value={p.why} onChange={(e) => editPillar(p.id, { why: e.target.value })} />
              <label className="vi-yes">
                This means
                <textarea className="input" rows={3} placeholder="One idea per line" value={p.yes} onChange={(e) => editPillar(p.id, { yes: e.target.value })} />
              </label>
              <label className="vi-no">
                This rules out
                <textarea className="input" rows={3} placeholder="One idea per line" value={p.no} onChange={(e) => editPillar(p.id, { no: e.target.value })} />
              </label>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost vi-add" onClick={() => set({ pillars: [...d.pillars, newPillar(d.pillars.length)] })}>
          <Plus size={14} /> Add pillar
        </button>

        <h2>References</h2>
        {d.references.map((r) => (
          <div key={r.id} className="vi-usp">
            <input className="input" style={{ width: 200 }} placeholder="Game, film, book…" value={r.name} onChange={(e) => set({ references: d.references.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) })} />
            <input className="input" placeholder="What we take from it" value={r.takeaway} onChange={(e) => set({ references: d.references.map((x) => (x.id === r.id ? { ...x, takeaway: e.target.value } : x)) })} />
            <button className="icon-btn" aria-label="Remove" onClick={() => set({ references: d.references.filter((x) => x.id !== r.id) })}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button className="btn btn-ghost vi-add" onClick={() => set({ references: [...d.references, { id: newId(), name: '', takeaway: '' }] })}>
          <Plus size={14} /> Add reference
        </button>

        <h2>What this game is not</h2>
        {text('antiGoals', 'Anti-goals', 'Things you decided against, so nobody adds them later: "No crafting", "No online multiplayer"…', 3)}
      </div>
    </div>
  )
}
