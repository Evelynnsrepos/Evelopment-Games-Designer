import { ChevronDown, ChevronRight, CornerLeftUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useUndoRedoKeys } from '@/core/state'
import { confirmDialog } from '@/shared/dialogs'
import {
  addBody,
  BODY_KINDS,
  CHILD_KIND,
  childrenOf,
  colorOf,
  createCosmos,
  findBody,
  KIND_LABEL,
  KIND_STYLE,
  moveBody,
  orbitLayout,
  pathTo,
  removeBody,
  subtreeIds,
  updateBody,
  type Body,
  type BodyKind,
  type Cosmos,
} from './model'
import './cosmos.css'

const UI = {
  top: 'Cosmos',
  add: 'Add',
  addInside: 'Add inside',
  open: 'Show inside',
  up: 'Up one level',
  name: 'Name',
  kind: 'Kind',
  color: 'Color',
  defaultColor: 'Default',
  notes: 'Notes',
  notesHint: 'Where it is, who lives there, what happened here…',
  delete: 'Delete',
  empty: 'This cosmos is empty. Add a universe or a galaxy to begin, then add solar systems, planets and moons inside it.',
  emptyHere: 'Nothing inside yet. Use Add to place something here.',
  dropTop: 'Drop here to move to the top level',
  inside: (n: number) => `${n} inside`,
  hint: 'Click to select, double-click to look inside. Drag in the list to move things.',
}

const DRAG = 'application/x-egd-cosmos-body'

export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument('cosmos', documentId!, createCosmos)
  useUndoRedoKeys(doc, active)
  const [focusId, setFocusId] = useState<Id | null>(null)
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  const [addKind, setAddKind] = useState<BodyKind | ''>('')
  const [collapsed, setCollapsed] = useState<Record<Id, boolean>>({})

  const cosmos = doc.data
  if (!cosmos) return null
  const edit = (fn: (c: Cosmos) => Cosmos) => doc.update(fn)

  // A body deleted (or undone away) elsewhere must not stay focused.
  const focus = findBody(cosmos, focusId) ?? null
  const selected = findBody(cosmos, selectedId) ?? null
  const shown = childrenOf(cosmos, focus?.id ?? null)

  const add = (parentId: Id | null, kind?: BodyKind) => {
    let created: Body | undefined
    edit((c) => {
      const r = addBody(c, parentId, kind)
      created = r.body
      return r.cosmos
    })
    if (created) setSelectedId(created.id)
  }

  const remove = async (b: Body) => {
    const inside = subtreeIds(cosmos, b.id).size - 1
    const ok = await confirmDialog({
      title: `Delete ${b.name}?`,
      message: inside ? `This also deletes the ${inside} things inside it. You can undo with Ctrl+Z.` : 'You can undo with Ctrl+Z.',
      confirmLabel: UI.delete,
      danger: true,
    })
    if (!ok) return
    if (selectedId && subtreeIds(cosmos, b.id).has(selectedId)) setSelectedId(null)
    edit((c) => removeBody(c, b.id))
  }

  const look = (id: Id | null) => {
    setFocusId(id)
    setSelectedId(id)
  }

  const onDrop = (e: React.DragEvent, parentId: Id | null) => {
    const id = e.dataTransfer.getData(DRAG)
    if (!id) return
    e.preventDefault()
    e.stopPropagation()
    edit((c) => moveBody(c, id, parentId))
  }
  const allowDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG)) e.preventDefault()
  }

  const renderTree = (parentId: Id | null, depth: number) =>
    childrenOf(cosmos, parentId).map((b) => {
      const kids = childrenOf(cosmos, b.id).length
      const open = !collapsed[b.id]
      return (
        <div key={b.id}>
          <div
            className={`cosmos-row${b.id === selectedId ? ' selected' : ''}`}
            style={{ paddingLeft: 6 + depth * 14 }}
            draggable
            onDragStart={(e) => e.dataTransfer.setData(DRAG, b.id)}
            onDragOver={allowDrop}
            onDrop={(e) => onDrop(e, b.id)}
            onClick={() => setSelectedId(b.id)}
            onDoubleClick={() => look(b.id)}
            title={KIND_LABEL[b.kind]}
          >
            <button
              className="icon-btn cosmos-twisty"
              style={{ visibility: kids ? 'visible' : 'hidden' }}
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed({ ...collapsed, [b.id]: open })
              }}
            >
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <span className="cosmos-dot" style={{ background: colorOf(b) }} />
            <span className="cosmos-row-name">{b.name}</span>
            <span className="cosmos-row-kind">{KIND_LABEL[b.kind]}</span>
          </div>
          {open && renderTree(b.id, depth + 1)}
        </div>
      )
    })

  const orbits = orbitLayout(shown.length)

  return (
    <div className="cosmos-root">
      <aside className="cosmos-tree" onDragOver={allowDrop} onDrop={(e) => onDrop(e, null)} title={UI.dropTop}>
        <div className={`cosmos-row cosmos-top${selectedId === null ? ' selected' : ''}`} onClick={() => look(null)}>
          {UI.top}
        </div>
        {renderTree(null, 0)}
      </aside>

      <section className="cosmos-main">
        <div className="cosmos-toolbar">
          <button className="icon-btn" title={UI.up} disabled={!focus} onClick={() => look(focus?.parentId ?? null)}>
            <CornerLeftUp size={15} />
          </button>
          <nav className="cosmos-crumbs">
            <button onClick={() => look(null)}>{UI.top}</button>
            {pathTo(cosmos, focus?.id ?? null).map((b) => (
              <span key={b.id}>
                {' › '}
                <button onClick={() => look(b.id)}>{b.name}</button>
              </span>
            ))}
          </nav>
          <select className="input cosmos-kind" value={addKind} aria-label={UI.kind} onChange={(e) => setAddKind(e.target.value as BodyKind | '')}>
            <option value="">{KIND_LABEL[focus ? CHILD_KIND[focus.kind] : 'galaxy']}</option>
            {BODY_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => add(focus?.id ?? null, addKind || undefined)}>
            <Plus size={14} /> {UI.add}
          </button>
        </div>

        <svg className="cosmos-orbits" viewBox="-320 -320 640 640" onClick={() => setSelectedId(focus?.id ?? null)}>
          {orbits.map((o, i) => (
            <circle key={shown[i].id} r={o.r} className="cosmos-orbit" />
          ))}
          {focus ? (
            <BodyMark body={focus} x={0} y={0} scale={2} selected={selectedId === focus.id} label={false} />
          ) : (
            <circle r={6} className="cosmos-center" />
          )}
          {shown.map((b, i) => (
            <g
              key={b.id}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(b.id)
              }}
              onDoubleClick={() => look(b.id)}
            >
              <BodyMark body={b} x={orbits[i].x} y={orbits[i].y} scale={1} selected={selectedId === b.id} label inside={childrenOf(cosmos, b.id).length} />
            </g>
          ))}
        </svg>
        <p className="cosmos-hint">{cosmos.bodies.length === 0 ? UI.empty : shown.length === 0 ? UI.emptyHere : UI.hint}</p>
      </section>

      {selected && (
        <aside className="cosmos-details">
          <label>
            {UI.name}
            <input className="input" value={selected.name} onChange={(e) => edit((c) => updateBody(c, selected.id, { name: e.target.value }))} />
          </label>
          <label>
            {UI.kind}
            <select className="input" value={selected.kind} onChange={(e) => edit((c) => updateBody(c, selected.id, { kind: e.target.value as BodyKind }))}>
              {BODY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {UI.color}
            <span className="cosmos-color">
              <input type="color" value={colorOf(selected)} onChange={(e) => edit((c) => updateBody(c, selected.id, { color: e.target.value }))} />
              <button className="btn btn-ghost" disabled={!selected.color} onClick={() => edit((c) => updateBody(c, selected.id, { color: null }))}>
                {UI.defaultColor}
              </button>
            </span>
          </label>
          <label>
            {UI.notes}
            <textarea
              className="input cosmos-notes"
              placeholder={UI.notesHint}
              value={selected.notes}
              onChange={(e) => edit((c) => updateBody(c, selected.id, { notes: e.target.value }))}
            />
          </label>
          <div className="cosmos-actions">
            <button className="btn" onClick={() => add(selected.id)}>
              <Plus size={14} /> {UI.addInside}
            </button>
            <button className="btn" onClick={() => look(selected.id)}>
              {UI.open}
            </button>
            <button className="btn btn-ghost cosmos-delete" title={UI.delete} onClick={() => void remove(selected)}>
              <Trash2 size={14} />
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}

function BodyMark(p: { body: Body; x: number; y: number; scale: number; selected: boolean; label: boolean; inside?: number }) {
  const r = KIND_STYLE[p.body.kind].size * p.scale
  const color = colorOf(p.body)
  const diffuse = p.body.kind === 'galaxy' || p.body.kind === 'nebula' || p.body.kind === 'universe'
  return (
    <g transform={`translate(${p.x} ${p.y})`} className="cosmos-body">
      {p.selected && <circle r={r + 6} className="cosmos-selection" />}
      {p.body.kind === 'asteroid-belt' ? (
        <circle r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray="2 3" />
      ) : diffuse ? (
        <ellipse rx={r * 1.3} ry={r * 0.75} fill={color} opacity={0.75} />
      ) : (
        <circle r={r} fill={color} stroke={p.body.kind === 'black-hole' ? 'var(--accent)' : 'none'} strokeWidth={2} />
      )}
      {p.label && (
        <text y={r + 14} className="cosmos-label">
          {p.body.name}
          {p.inside ? ` (${UI.inside(p.inside)})` : ''}
        </text>
      )}
    </g>
  )
}
