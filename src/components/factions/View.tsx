import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Entity, Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys } from '@/core/state'
import { Field, ListDetail } from '@/shared/listDetail'
import { ProofTextarea } from '@/shared/spell'
import { createFactionsDoc, LEVELS, levelLabel, newFaction, relation, relationColor, removeFaction, setRelation, type Faction, type FactionsDoc } from './model'
import './factions.css'

/** Factions & relations matrix (v0.10). */
export default function View({ active }: PanelProps) {
  const doc = useDocument<FactionsDoc>('factions', 'factions', createFactionsDoc)
  useUndoRedoKeys(doc, active)
  const entities = useProjectStore((s) => s.entities)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [matrix, setMatrix] = useState(true)
  if (!doc.data) return null
  const d = doc.data
  const set = (fn: (d: FactionsDoc) => FactionsDoc) => doc.update(fn)
  const edit = (id: Id, patch: Partial<Faction>) => set((x) => ({ ...x, items: x.items.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))
  const f = d.items.find((x) => x.id === selectedId)
  const characters = entities.character as Entity[]
  const towns = entities.town as Entity[]
  const name = (list: Entity[], id: Id | null) => list.find((e) => e.id === id)?.name ?? ''

  return (
    <ListDetail
      rows={d.items.map((x) => ({ id: x.id, label: x.name, sub: name(characters, x.leaderId), color: x.color }))}
      selectedId={matrix ? null : selectedId}
      onSelect={(id) => {
        setSelectedId(id)
        setMatrix(false)
      }}
      onAdd={() => {
        const n = newFaction(d.items.length)
        set((x) => ({ ...x, items: [...x.items, n] }))
        setSelectedId(n.id)
        setMatrix(false)
      }}
      addLabel="New faction"
      empty="No factions yet. Make one with New faction."
      toolbar={
        <>
          <button className={`btn${matrix ? ' btn-primary' : ''}`} onClick={() => setMatrix(true)}>
            Relations matrix
          </button>
          <label className="ld-inline">
            <input type="checkbox" checked={d.mutual} onChange={(e) => set((x) => ({ ...x, mutual: e.target.checked }))} /> Same both ways
          </label>
        </>
      }
    >
      {matrix ? (
        <Matrix d={d} onChange={(a, b, v) => set((x) => setRelation(x, a, b, v))} />
      ) : (
        f && (
          <div className="ld-page">
            <div className="wide ld-inline">
              <input type="color" value={f.color} onChange={(e) => edit(f.id, { color: e.target.value })} aria-label="Color" />
              <input className="input" style={{ flex: 1, fontSize: 18, fontWeight: 600 }} value={f.name} onChange={(e) => edit(f.id, { name: e.target.value })} aria-label="Name" />
            </div>
            <Field label="Leader">
              <select className="input" value={f.leaderId ?? ''} onChange={(e) => edit(f.id, { leaderId: e.target.value || null })}>
                <option value="">None</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Untitled'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" wide>
              <ProofTextarea className="input" rows={3} value={f.description} onChange={(e) => edit(f.id, { description: e.target.value })} />
            </Field>
            <Field label="Goals and beliefs" wide>
              <ProofTextarea className="input" rows={2} value={f.goals} onChange={(e) => edit(f.id, { goals: e.target.value })} />
            </Field>
            <Picker label="Members" all={characters} ids={f.members} onChange={(members) => edit(f.id, { members })} />
            <Picker label="Towns" all={towns} ids={f.towns} onChange={(t) => edit(f.id, { towns: t })} />
            <div className="ld-section">
              <strong>How {f.name} feels about the others</strong>
              {d.items
                .filter((o) => o.id !== f.id)
                .map((o) => (
                  <div key={o.id} className="ld-inline">
                    <span className="fx-dot" style={{ background: o.color }} />
                    <span style={{ minWidth: 140 }}>{o.name}</span>
                    <input type="range" min={-100} max={100} step={10} value={relation(d, f.id, o.id)} onChange={(e) => set((x) => setRelation(x, f.id, o.id, Number(e.target.value)))} />
                    <span>{levelLabel(relation(d, f.id, o.id))}</span>
                  </div>
                ))}
            </div>
            <button
              className="btn btn-danger ld-danger"
              onClick={() => {
                set((x) => removeFaction(x, f.id))
                setSelectedId(null)
              }}
            >
              <Trash2 size={14} /> Delete faction
            </button>
          </div>
        )
      )}
    </ListDetail>
  )
}

function Picker({ label, all, ids, onChange }: { label: string; all: Entity[]; ids: Id[]; onChange(ids: Id[]): void }) {
  return (
    <div className="ld-section">
      <strong>{label}</strong>
      <div className="ld-inline">
        {ids.map((id) => (
          <button key={id} className="btn btn-ghost" title="Remove" onClick={() => onChange(ids.filter((x) => x !== id))}>
            {all.find((e) => e.id === id)?.name ?? '(deleted)'} ×
          </button>
        ))}
        <select className="input" value="" onChange={(e) => e.target.value && onChange([...ids, e.target.value])}>
          <option value="">Add…</option>
          {all
            .filter((e) => !ids.includes(e.id))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name || 'Untitled'}
              </option>
            ))}
        </select>
      </div>
    </div>
  )
}

function Matrix({ d, onChange }: { d: FactionsDoc; onChange(a: Id, b: Id, v: number): void }) {
  if (d.items.length < 2) return <p className="muted">Add at least two factions to set how they feel about each other.</p>
  return (
    <div>
      <p className="muted">Each row shows how that faction feels about the one in the column. Pick a level in any cell.</p>
      <table className="fx-matrix">
        <thead>
          <tr>
            <th />
            {d.items.map((f) => (
              <th key={f.id} style={{ color: f.color }}>
                {f.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.items.map((a) => (
            <tr key={a.id}>
              <th style={{ color: a.color }}>{a.name}</th>
              {d.items.map((b) => {
                if (a.id === b.id) return <td key={b.id} className="fx-self" />
                const v = relation(d, a.id, b.id)
                return (
                  <td key={b.id} style={{ background: relationColor(v) }}>
                    <select value={LEVELS.reduce((best, l) => (Math.abs(l.value - v) < Math.abs(best.value - v) ? l : best)).value} onChange={(e) => onChange(a.id, b.id, Number(e.target.value))}>
                      {LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
