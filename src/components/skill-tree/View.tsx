import { Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useUndoRedoKeys } from '@/core/state'
import { NumberInput, PresetHeader } from '@/shared/calculators'
import { confirmDialog } from '@/shared/dialogs'
import { ImagePicker } from '@/shared/entityList'
import { FlowGraph } from '@/shared/graph'
import { ProofTextarea } from '@/shared/spell'
import {
  cannotAdd,
  cannotRemove,
  createSkillTreeDoc,
  fullTreeCost,
  newSkill,
  normalizeSkillTree,
  SKILL_KINDS,
  spent,
  totalPoints,
  wouldLoop,
  type Skill,
  type SkillTreeDoc,
} from './model'
import './skill-tree.css'

const T = {
  kind: 'Skill tree',
  add: 'New skill',
  edit: 'Edit',
  plan: 'Plan a build',
  empty: 'No skills yet. Make one with New skill, then link skills with "Needs first" to grow the tree.',
  summary: (n: number, cost: number) => `${n} skills · maxing everything costs ${cost} points`,
  name: 'Name',
  type: 'Type',
  effect: 'Effect',
  effectHint: 'e.g. +5% crit chance per rank',
  maxRank: 'Max rank',
  cost: 'Points per rank',
  pointsNeeded: 'Points spent in the tree first',
  requires: 'Needs first',
  addRequire: 'Add a skill…',
  unlocks: 'Unlocks',
  notes: 'Notes',
  delete: 'Delete skill',
  loop: 'That would make a loop: the skill would need itself.',
  start: 'Points at start',
  perLevel: 'Points per level',
  level: 'Level',
  spent: (a: number, b: number) => `${a} of ${b} points spent`,
  reset: 'Reset build',
  pick: 'Click a skill in the tree to put points into it.',
  rank: (r: number, m: number) => `Rank ${r} of ${m}`,
}

const kindColor = (k: Skill['kind']) => SKILL_KINDS.find((x) => x.id === k)?.color

/** Skill / talent tree editor with a build planner. */
export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<SkillTreeDoc>('skill-tree', documentId!, createSkillTreeDoc)
  useUndoRedoKeys(doc, active)
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  const [mode, setMode] = useState<'edit' | 'plan'>('edit')
  const [message, setMessage] = useState<string | null>(null)
  if (!doc.data) return null
  const d = normalizeSkillTree(doc.data)
  const set = (fn: (d: SkillTreeDoc) => Partial<SkillTreeDoc>) => doc.update((x) => ({ ...normalizeSkillTree(x), ...fn(normalizeSkillTree(x)) }))
  const edit = (id: Id, patch: Partial<Skill>) => set((x) => ({ skills: x.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const sel = d.skills.find((s) => s.id === selectedId) ?? null

  const add = () => {
    const s = newSkill()
    set((x) => ({ skills: [...x.skills, s] }))
    setSelectedId(s.id)
    setMode('edit')
  }
  const remove = async (s: Skill) => {
    if (!(await confirmDialog({ title: `Delete ${s.name}?`, message: 'Skills that needed it lose that link. You can undo with Ctrl+Z.', confirmLabel: 'Delete', danger: true }))) return
    set((x) => {
      const plan = { ...x.plan }
      delete plan[s.id]
      return { skills: x.skills.filter((o) => o.id !== s.id).map((o) => ({ ...o, requires: o.requires.filter((r) => r !== s.id) })), plan }
    })
    setSelectedId(null)
  }
  const changeRank = (id: Id, delta: 1 | -1) => {
    const why = delta > 0 ? cannotAdd(d, id) : cannotRemove(d, id)
    if (why) return setMessage(why)
    setMessage(null)
    set((x) => ({ plan: { ...x.plan, [id]: (x.plan[id] ?? 0) + delta } }))
  }

  return (
    <div className="skills">
      <div className="skills-head">
        <PresetHeader documentId={documentId!} kind={T.kind} undo={doc.undo} redo={doc.redo} canUndo={doc.canUndo} canRedo={doc.canRedo} />
      </div>
      <div className="skills-toolbar">
        <button className="btn btn-primary" onClick={add}>
          <Plus size={14} /> {T.add}
        </button>
        <div className="calc-segmented skills-mode" role="tablist">
          <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>
            {T.edit}
          </button>
          <button className={mode === 'plan' ? 'on' : ''} onClick={() => setMode('plan')}>
            {T.plan}
          </button>
        </div>
        {mode === 'plan' ? (
          <>
            <label className="skills-field">
              {T.start}
              <NumberInput value={d.budget.start} min={0} onChange={(v) => set((x) => ({ budget: { ...x.budget, start: v } }))} />
            </label>
            <label className="skills-field">
              {T.perLevel}
              <NumberInput value={d.budget.perLevel} min={0} onChange={(v) => set((x) => ({ budget: { ...x.budget, perLevel: v } }))} />
            </label>
            <label className="skills-field">
              {T.level}
              <NumberInput value={d.budget.level} min={0} onChange={(v) => set((x) => ({ budget: { ...x.budget, level: v } }))} />
            </label>
            <span className={`skills-total${spent(d) > totalPoints(d) ? ' over' : ''}`}>{T.spent(spent(d), totalPoints(d))}</span>
            <button className="btn btn-ghost" onClick={() => set(() => ({ plan: {} }))}>
              <RotateCcw size={14} /> {T.reset}
            </button>
          </>
        ) : (
          <span className="skills-total">{T.summary(d.skills.length, fullTreeCost(d.skills))}</span>
        )}
      </div>

      <div className="skills-body">
        <div className="skills-graph">
          {d.skills.length === 0 ? (
            <p className="muted skills-empty">{T.empty}</p>
          ) : (
            <FlowGraph
              nodes={d.skills.map((s) => {
                const rank = d.plan[s.id] ?? 0
                return {
                  id: s.id,
                  label: s.name || 'Untitled skill',
                  sub: mode === 'plan' ? `${rank} / ${s.maxRank}` : `${s.maxRank > 1 ? `${s.maxRank} ranks · ` : ''}${s.cost} pt${s.cost === 1 ? '' : 's'}`,
                  color: kindColor(s.kind),
                  muted: mode === 'plan' && rank === 0,
                }
              })}
              edges={d.skills.flatMap((s) => s.requires.map((r) => ({ from: r, to: s.id })))}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id)
                if (mode === 'plan' && id !== selectedId) setMessage(null)
              }}
            />
          )}
        </div>
        {mode === 'plan' ? (
          <aside className="skills-side">
            {sel ? (
              <>
                <h3>{sel.name}</h3>
                {sel.effect && <p>{sel.effect}</p>}
                <div className="skills-rank">
                  <button className="icon-btn" aria-label="Take back a rank" title="Take back a rank" onClick={() => changeRank(sel.id, -1)}>
                    <Minus size={16} />
                  </button>
                  <strong>{T.rank(d.plan[sel.id] ?? 0, sel.maxRank)}</strong>
                  <button className="icon-btn" aria-label="Add a rank" title="Add a rank" onClick={() => changeRank(sel.id, 1)}>
                    <Plus size={16} />
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">{T.pick}</p>
            )}
            {message && <p className="skills-message">{message}</p>}
          </aside>
        ) : (
          sel && <SkillDetail s={sel} skills={d.skills} edit={(p) => edit(sel.id, p)} onRemove={() => void remove(sel)} onSelect={setSelectedId} onLoop={() => setMessage(T.loop)} message={message} />
        )}
      </div>
    </div>
  )
}

function SkillDetail({
  s,
  skills,
  edit,
  onRemove,
  onSelect,
  onLoop,
  message,
}: {
  s: Skill
  skills: Skill[]
  edit(p: Partial<Skill>): void
  onRemove(): void
  onSelect(id: Id): void
  onLoop(): void
  message: string | null
}) {
  const others = skills.filter((o) => o.id !== s.id && !s.requires.includes(o.id))
  const unlocks = skills.filter((o) => o.requires.includes(s.id))
  return (
    <aside className="skills-side">
      <div className="skills-detail-head">
        <div className="skills-image">
          <ImagePicker path={s.image} alt={s.name} onChange={(image) => edit({ image })} />
        </div>
        <label className="skills-field grow">
          {T.name}
          <input className="input" value={s.name} onChange={(e) => edit({ name: e.target.value })} />
        </label>
      </div>
      <label className="skills-field">
        {T.type}
        <select className="input" value={s.kind} onChange={(e) => edit({ kind: e.target.value as Skill['kind'] })}>
          {SKILL_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="skills-field">
        {T.effect}
        <input className="input" placeholder={T.effectHint} value={s.effect} onChange={(e) => edit({ effect: e.target.value })} />
      </label>
      <div className="skills-row">
        <label className="skills-field">
          {T.maxRank}
          <NumberInput value={s.maxRank} min={1} onChange={(v) => edit({ maxRank: Math.max(1, Math.round(v)) })} />
        </label>
        <label className="skills-field">
          {T.cost}
          <NumberInput value={s.cost} min={0} onChange={(v) => edit({ cost: Math.max(0, v) })} />
        </label>
        <label className="skills-field">
          {T.pointsNeeded}
          <NumberInput value={s.pointsNeeded} min={0} onChange={(v) => edit({ pointsNeeded: Math.max(0, v) })} />
        </label>
      </div>
      <div className="skills-field">
        {T.requires}
        <div className="skills-chips">
          {s.requires.map((r) => (
            <span key={r} className="skills-chip">
              <button className="skills-link" onClick={() => onSelect(r)}>
                {skills.find((o) => o.id === r)?.name ?? '?'}
              </button>
              <button className="icon-btn" aria-label="Remove" onClick={() => edit({ requires: s.requires.filter((x) => x !== r) })}>
                <X size={12} />
              </button>
            </span>
          ))}
          {others.length > 0 && (
            <select
              className="input"
              value=""
              onChange={(e) => {
                const id = e.target.value
                if (!id) return
                if (wouldLoop(skills, s.id, id)) return onLoop()
                edit({ requires: [...s.requires, id] })
              }}
            >
              <option value="">{T.addRequire}</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {unlocks.length > 0 && (
        <div className="skills-field">
          {T.unlocks}
          <div className="skills-chips">
            {unlocks.map((o) => (
              <button key={o.id} className="skills-link skills-chip" onClick={() => onSelect(o.id)}>
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="skills-field">
        {T.notes}
        <ProofTextarea className="input" rows={3} value={s.notes} onChange={(e) => edit({ notes: e.target.value })} />
      </label>
      {message && <p className="skills-message">{message}</p>}
      <button className="btn btn-danger skills-delete" onClick={onRemove}>
        <Trash2 size={14} /> {T.delete}
      </button>
    </aside>
  )
}
