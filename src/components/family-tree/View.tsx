import { Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAssetUrls } from '@/core/assets'
import type { Entity, Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys } from '@/core/state'
import { openEntity } from '@/shared/entityList'
import { CARD_H, CARD_W, childrenOf, createFamilyDoc, layoutFamily, newBond, parentsOf, partnersOf, wouldLoop, type Bond, type FamilyDoc } from './model'
import './family-tree.css'

/** Family tree (v0.10): characters joined as parents, children and partners. */
export default function View({ active }: PanelProps) {
  const doc = useDocument<FamilyDoc>('family-tree', 'family-tree', createFamilyDoc)
  useUndoRedoKeys(doc, active)
  const characters = useProjectStore((s) => s.entities.character) as Entity[]
  const [sel, setSel] = useState<Id | null>(null)
  const [message, setMessage] = useState('')
  const d = useMemo(() => {
    const raw = doc.data ?? createFamilyDoc()
    // Characters deleted from the list drop out of the tree.
    const alive = new Set(characters.map((c) => c.id))
    return { people: raw.people.filter((p) => alive.has(p)), bonds: raw.bonds.filter((b) => alive.has(b.a) && alive.has(b.b)) }
  }, [doc.data, characters])
  const pos = useMemo(() => layoutFamily(d), [d])
  const img = useAssetUrls(characters.map((c) => c.image))
  if (!doc.data) return null
  const set = (fn: (x: FamilyDoc) => FamilyDoc) => doc.update(fn)
  const byId = (id: Id) => characters.find((c) => c.id === id)
  const outside = characters.filter((c) => !d.people.includes(c.id))

  const link = (kind: Bond['kind'] | 'child', other: Id) => {
    if (!sel) return
    const [a, b, k] = kind === 'child' ? [sel, other, 'parent' as const] : kind === 'parent' ? [other, sel, 'parent' as const] : [sel, other, 'partner' as const]
    if (k === 'parent' && wouldLoop(d, a, b)) return setMessage('That would make someone their own ancestor.')
    setMessage('')
    set((x) => ({ people: x.people.includes(other) ? x.people : [...x.people, other], bonds: [...x.bonds, newBond(k, a, b)] }))
  }

  const xs = [...pos.values()].map((p) => p.x)
  const ys = [...pos.values()].map((p) => p.y)
  const w = (xs.length ? Math.max(...xs) : 0) + CARD_W + 40
  const h = (ys.length ? Math.max(...ys) : 0) + CARD_H + 40

  // Children hang from the middle of their parents.
  const childLines = d.people.flatMap((c) => {
    const ps = parentsOf(d, c).filter((p) => pos.has(p))
    const cp = pos.get(c)
    if (!ps.length || !cp) return []
    const mx = ps.reduce((s, p) => s + pos.get(p)!.x, 0) / ps.length + CARD_W / 2
    const py = pos.get(ps[0])!.y + CARD_H
    const cx = cp.x + CARD_W / 2
    const mid = py + (cp.y - py) / 2
    return [<path key={`c${c}`} d={`M ${mx} ${py} V ${mid} H ${cx} V ${cp.y}`} className="ft-line" />]
  })
  const partnerLines = d.bonds
    .filter((b) => b.kind === 'partner' && pos.has(b.a) && pos.has(b.b))
    .map((b) => {
      const p = pos.get(b.a)!
      const q = pos.get(b.b)!
      const [l, r] = p.x < q.x ? [p, q] : [q, p]
      return <line key={b.id} x1={l.x + CARD_W} y1={l.y + CARD_H / 2} x2={r.x} y2={r.y + CARD_H / 2} className="ft-partner" />
    })

  const selChar = sel ? byId(sel) : undefined
  const pick = (label: string, kind: Bond['kind'] | 'child', exclude: Id[]) => (
    <label className="ft-pick">
      {label}
      <select className="input" value="" onChange={(e) => e.target.value && link(kind, e.target.value)}>
        <option value="">Choose a character…</option>
        {characters
          .filter((c) => c.id !== sel && !exclude.includes(c.id))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || 'Untitled'}
            </option>
          ))}
      </select>
    </label>
  )

  return (
    <div className="ft">
      <div className="ld-toolbar ft-toolbar">
        <select
          className="input"
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (id) {
              set((x) => ({ ...x, people: [...x.people, id] }))
              setSel(id)
            }
          }}
        >
          <option value="">{outside.length ? 'Add a character to the tree…' : characters.length ? 'Everyone is in the tree' : 'Make characters in the Character List first'}</option>
          {outside.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || 'Untitled'}
            </option>
          ))}
        </select>
        <span className="muted">Click someone to add parents, children or partners.</span>
      </div>
      <div className="ft-body">
        <div className="ft-canvas" onClick={(e) => e.target === e.currentTarget && setSel(null)}>
          <svg width={w} height={h} viewBox={`-20 -20 ${w} ${h}`}>
            {childLines}
            {partnerLines}
            {d.people.map((id) => {
              const p = pos.get(id)
              const c = byId(id)
              if (!p || !c) return null
              return (
                <g key={id} transform={`translate(${p.x} ${p.y})`} className={`ft-card${sel === id ? ' on' : ''}`} onClick={() => setSel(id)} onDoubleClick={() => openEntity('character', id)}>
                  <rect width={CARD_W} height={CARD_H} rx={8} />
                  {c.image ? <image href={img(c.image)} x={6} y={6} width={44} height={44} preserveAspectRatio="xMidYMid slice" /> : <rect x={6} y={6} width={44} height={44} rx={6} className="ft-noimg" />}
                  <text x={58} y={26} className="ft-name">
                    {(c.name || 'Untitled').slice(0, 12)}
                  </text>
                  <text x={58} y={42} className="ft-sub">
                    {d.bonds.find((b) => b.kind === 'partner' && (b.a === id || b.b === id))?.note.slice(0, 14)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        {selChar && sel && (
          <aside className="ft-side">
            <h3>{selChar.name || 'Untitled'}</h3>
            {pick('Add a parent', 'parent', parentsOf(d, sel))}
            {pick('Add a child', 'child', childrenOf(d, sel))}
            {pick('Add a partner', 'partner', partnersOf(d, sel))}
            {message && <p className="ft-warn">{message}</p>}
            <div className="ld-section">
              <strong>Family</strong>
              {d.bonds
                .filter((b) => b.a === sel || b.b === sel)
                .map((b) => {
                  const other = b.a === sel ? b.b : b.a
                  const role = b.kind === 'partner' ? 'Partner' : b.a === sel ? 'Child' : 'Parent'
                  return (
                    <div key={b.id} className="ld-inline">
                      <span style={{ minWidth: 56 }} className="muted">
                        {role}
                      </span>
                      <button className="btn btn-ghost" onClick={() => setSel(other)}>
                        {byId(other)?.name || 'Untitled'}
                      </button>
                      <input className="input" style={{ width: 110 }} placeholder={b.kind === 'partner' ? 'married…' : 'adopted…'} value={b.note} onChange={(e) => set((x) => ({ ...x, bonds: x.bonds.map((o) => (o.id === b.id ? { ...o, note: e.target.value } : o)) }))} />
                      <button className="icon-btn" aria-label="Remove link" title="Remove link" onClick={() => set((x) => ({ ...x, bonds: x.bonds.filter((o) => o.id !== b.id) }))}>
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
            </div>
            <button className="btn" onClick={() => openEntity('character', sel)}>
              <Plus size={14} /> Open character page
            </button>
            <button
              className="btn btn-danger ld-danger"
              onClick={() => {
                set((x) => ({ people: x.people.filter((p) => p !== sel), bonds: x.bonds.filter((b) => b.a !== sel && b.b !== sel) }))
                setSel(null)
              }}
            >
              <Trash2 size={14} /> Take out of the tree
            </button>
          </aside>
        )}
      </div>
    </div>
  )
}
