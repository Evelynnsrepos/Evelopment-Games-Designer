import { GitBranch, List, Plus, Search, Trash2, Variable, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Entity, EntityType, Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys } from '@/core/state'
import { confirmDialog } from '@/shared/dialogs'
import { ChangesEditor, ConditionsEditor, describeChange, FlagsEditor, useFlags } from '@/shared/flags'
import { FlowGraph } from '@/shared/graph'
import {
  createQuestDoc,
  newObjective,
  newQuest,
  OBJECTIVE_KINDS,
  QUEST_KINDS,
  questPath,
  totalRewards,
  unlockedBy,
  wouldLoop,
  type Objective,
  type Quest,
  type QuestDoc,
} from './model'
import './quests.css'

const T = {
  add: 'New quest',
  search: 'Search quests',
  list: 'List',
  chain: 'Quest chains',
  flags: 'Flags',
  empty: 'No quests yet. Make one with New quest; link them with "Requires" to build chains.',
  name: 'Name',
  kind: 'Type',
  giver: 'Quest giver',
  location: 'Where',
  level: 'Level',
  summary: 'Summary',
  objectives: 'Objectives',
  addObjective: 'Add objective',
  optional: 'optional',
  rewards: 'Rewards',
  xp: 'XP',
  gold: 'Gold',
  addItem: 'Add item reward',
  requires: 'Requires (done first)',
  addRequire: 'Add a quest…',
  unlocks: 'Unlocks',
  startsIf: 'Starts only if',
  onDone: 'When done, set',
  notes: 'Notes',
  none: 'None',
  delete: 'Delete quest',
  chainTotal: (n: number) => `This quest and the ${n} before it give`,
  allTotal: (n: number) => `All ${n} quests give`,
  loop: 'That would make a loop: the quest would need itself.',
}

const kindColor = (k: Quest['kind']) => QUEST_KINDS.find((x) => x.id === k)?.color

/** Quest Designer (v0.7). */
export default function View({ active }: PanelProps) {
  const doc = useDocument<QuestDoc>('quests', 'quests', createQuestDoc)
  useUndoRedoKeys(doc, active)
  const entities = useProjectStore((s) => s.entities)
  const { flags } = useFlags()
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  const [tab, setTab] = useState<'list' | 'chain' | 'flags'>('list')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const quests = useMemo(() => doc.data?.quests ?? [], [doc.data])
  const shown = quests.filter((q) => !query.trim() || q.name.toLowerCase().includes(query.trim().toLowerCase()))
  const q = quests.find((x) => x.id === selectedId) ?? null

  if (!doc.data) return null
  const nameOf = (type: EntityType, id: Id | null) => (id ? (entities[type] as Entity[]).find((e) => e.id === id)?.name || '(deleted)' : '')
  const edit = (id: Id, patch: Partial<Quest>) => doc.update((d) => ({ quests: d.quests.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  const add = () => {
    const nq = newQuest()
    doc.update((d) => ({ quests: [...d.quests, nq] }))
    setSelectedId(nq.id)
    setTab('list')
  }
  const remove = async (quest: Quest) => {
    if (!(await confirmDialog({ title: `Delete ${quest.name}?`, message: 'Quests that required it lose that link. You can undo with Ctrl+Z.', confirmLabel: 'Delete', danger: true }))) return
    doc.update((d) => ({ quests: d.quests.filter((x) => x.id !== quest.id).map((x) => ({ ...x, requires: x.requires.filter((r) => r !== quest.id) })) }))
    setSelectedId(null)
  }
  const totals = (list: Quest[]) => {
    const t = totalRewards(list)
    const parts = [t.xp ? `${t.xp} XP` : '', t.gold ? `${t.gold} gold` : '', ...[...t.items].map(([id, n]) => `${n}× ${nameOf('item', id)}`)].filter(Boolean)
    return parts.join(', ') || T.none
  }

  return (
    <div className="quests">
      <div className="quests-toolbar">
        <button className="btn btn-primary" onClick={add}>
          <Plus size={14} /> {T.add}
        </button>
        <div className="quests-tabs" role="tablist">
          <button className={`btn btn-ghost${tab === 'list' ? ' is-active' : ''}`} onClick={() => setTab('list')}>
            <List size={14} /> {T.list}
          </button>
          <button className={`btn btn-ghost${tab === 'chain' ? ' is-active' : ''}`} onClick={() => setTab('chain')}>
            <GitBranch size={14} /> {T.chain}
          </button>
          <button className={`btn btn-ghost${tab === 'flags' ? ' is-active' : ''}`} onClick={() => setTab('flags')}>
            <Variable size={14} /> {T.flags}
          </button>
        </div>
        {tab === 'list' && (
          <label className="quests-search">
            <Search size={14} />
            <input className="input" placeholder={T.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        )}
        <span className="quests-total muted">
          {T.allTotal(quests.length)}: {totals(quests)}
        </span>
      </div>

      <div className="quests-body">
        {tab === 'flags' ? (
          <div className="quests-pane">
            <FlagsEditor />
          </div>
        ) : tab === 'chain' ? (
          <div className="quests-pane">
            {quests.length === 0 ? (
              <p className="muted">{T.empty}</p>
            ) : (
              <FlowGraph
                nodes={quests.map((x) => ({ id: x.id, label: x.name, sub: [nameOf('character', x.giverId), nameOf('town', x.locationId)].filter(Boolean).join(' · '), color: kindColor(x.kind) }))}
                edges={quests.flatMap((x) => x.requires.map((r) => ({ from: r, to: x.id })))}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id)
                  setTab('list')
                }}
              />
            )}
          </div>
        ) : (
          <>
            <div className="quests-list">
              {quests.length === 0 && <p className="muted quests-empty">{T.empty}</p>}
              {shown.map((x) => (
                <button key={x.id} className={`quests-row${x.id === selectedId ? ' is-selected' : ''}`} onClick={() => setSelectedId(x.id)}>
                  <span className="quests-kind" style={{ background: kindColor(x.kind) }} />
                  <span className="quests-row-main">
                    <span className="quests-row-name">{x.name || 'Untitled quest'}</span>
                    <span className="quests-row-meta">{[nameOf('character', x.giverId), nameOf('town', x.locationId), x.level ? `Lv ${x.level}` : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              ))}
            </div>
            {q && (
              <QuestDetail
                q={q}
                quests={quests}
                entities={entities}
                edit={(patch) => edit(q.id, patch)}
                onRemove={() => void remove(q)}
                onSelect={setSelectedId}
                chainTotal={`${T.chainTotal(questPath(quests, q.id).length)}: ${totals([...questPath(quests, q.id), q])}`}
                onLoop={() => setMessage(T.loop)}
                changesText={q.onComplete.map((c) => describeChange(c, flags)).join(', ')}
              />
            )}
          </>
        )}
      </div>
      {message && (
        <div className="quests-message" role="status" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
    </div>
  )
}

function EntitySelect({ type, value, onChange, entities, placeholder }: { type: EntityType; value: Id | null; onChange: (id: Id | null) => void; entities: Record<EntityType, Entity[]>; placeholder: string }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {entities[type].map((e) => (
        <option key={e.id} value={e.id}>
          {e.name || 'Untitled'}
        </option>
      ))}
    </select>
  )
}

function QuestDetail({
  q,
  quests,
  entities,
  edit,
  onRemove,
  onSelect,
  chainTotal,
  onLoop,
}: {
  q: Quest
  quests: Quest[]
  entities: Record<EntityType, Entity[]>
  edit: (patch: Partial<Quest>) => void
  onRemove: () => void
  onSelect: (id: Id) => void
  chainTotal: string
  onLoop: () => void
  changesText: string
}) {
  const setObjective = (id: Id, patch: Partial<Objective>) => edit({ objectives: q.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)) })
  const unlocks = unlockedBy(quests, q.id)
  return (
    <aside className="quests-detail">
      <div className="quests-detail-head">
        <input className="input quests-title" value={q.name} placeholder={T.name} onChange={(e) => edit({ name: e.target.value })} />
        <button className="icon-btn" title={T.delete} onClick={onRemove}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="quests-grid">
        <label className="quests-field">
          {T.kind}
          <select className="input" value={q.kind} onChange={(e) => edit({ kind: e.target.value as Quest['kind'] })}>
            {QUEST_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="quests-field">
          {T.giver}
          <EntitySelect type="character" value={q.giverId} entities={entities} placeholder={T.none} onChange={(giverId) => edit({ giverId })} />
        </label>
        <label className="quests-field">
          {T.location}
          <EntitySelect type="town" value={q.locationId} entities={entities} placeholder={T.none} onChange={(locationId) => edit({ locationId })} />
        </label>
        <label className="quests-field">
          {T.level}
          <input className="input" type="number" value={q.level ?? ''} onChange={(e) => edit({ level: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
      </div>
      <label className="quests-field">
        {T.summary}
        <textarea className="input quests-text" value={q.summary} onChange={(e) => edit({ summary: e.target.value })} />
      </label>

      <section className="quests-section">
        <h4>{T.objectives}</h4>
        {q.objectives.map((o, i) => {
          const target = OBJECTIVE_KINDS.find((k) => k.id === o.kind)?.target
          return (
            <div key={o.id} className="quests-objective">
              <span className="quests-num">{i + 1}.</span>
              <select className="input" value={o.kind} onChange={(e) => setObjective(o.id, { kind: e.target.value as Objective['kind'], targetId: null })}>
                {OBJECTIVE_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              {target && <EntitySelect type={target} value={o.targetId} entities={entities} placeholder="Choose…" onChange={(targetId) => setObjective(o.id, { targetId })} />}
              {(o.kind === 'kill' || o.kind === 'collect') && (
                <input className="input quests-amount" type="number" min={1} value={o.amount} onChange={(e) => setObjective(o.id, { amount: Math.max(1, Number(e.target.value) || 1) })} />
              )}
              <input className="input quests-objtext" placeholder="Description" value={o.text} onChange={(e) => setObjective(o.id, { text: e.target.value })} />
              <label className="quests-check">
                <input type="checkbox" checked={o.optional} onChange={(e) => setObjective(o.id, { optional: e.target.checked })} /> {T.optional}
              </label>
              <button className="icon-btn" title="Remove" onClick={() => edit({ objectives: q.objectives.filter((x) => x.id !== o.id) })}>
                <X size={13} />
              </button>
            </div>
          )
        })}
        <button className="btn btn-ghost quests-add" onClick={() => edit({ objectives: [...q.objectives, newObjective()] })}>
          <Plus size={13} /> {T.addObjective}
        </button>
      </section>

      <section className="quests-section">
        <h4>{T.rewards}</h4>
        <div className="quests-grid">
          <label className="quests-field">
            {T.xp}
            <input className="input" type="number" value={q.rewardXp} onChange={(e) => edit({ rewardXp: Number(e.target.value) || 0 })} />
          </label>
          <label className="quests-field">
            {T.gold}
            <input className="input" type="number" value={q.rewardGold} onChange={(e) => edit({ rewardGold: Number(e.target.value) || 0 })} />
          </label>
        </div>
        {q.rewardItems.map((r, i) => (
          <div key={i} className="quests-objective">
            <EntitySelect type="item" value={r.itemId} entities={entities} placeholder="Choose an item…" onChange={(itemId) => edit({ rewardItems: q.rewardItems.map((x, j) => (j === i ? { ...x, itemId: itemId ?? '' } : x)) })} />
            <input className="input quests-amount" type="number" min={1} value={r.amount} onChange={(e) => edit({ rewardItems: q.rewardItems.map((x, j) => (j === i ? { ...x, amount: Math.max(1, Number(e.target.value) || 1) } : x)) })} />
            <button className="icon-btn" title="Remove" onClick={() => edit({ rewardItems: q.rewardItems.filter((_, j) => j !== i) })}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button className="btn btn-ghost quests-add" onClick={() => edit({ rewardItems: [...q.rewardItems, { itemId: '', amount: 1 }] })}>
          <Plus size={13} /> {T.addItem}
        </button>
        <p className="muted quests-small">{chainTotal}</p>
      </section>

      <section className="quests-section">
        <h4>{T.requires}</h4>
        <div className="quests-chips">
          {q.requires.map((r) => (
            <span key={r} className="quests-chip">
              <button className="quests-link" onClick={() => onSelect(r)}>
                {quests.find((x) => x.id === r)?.name || '(deleted)'}
              </button>
              <button className="icon-btn" title="Remove" onClick={() => edit({ requires: q.requires.filter((x) => x !== r) })}>
                <X size={12} />
              </button>
            </span>
          ))}
          <select
            className="input"
            value=""
            onChange={(e) => {
              const id = e.target.value
              if (!id) return
              if (wouldLoop(quests, q.id, id)) return onLoop()
              edit({ requires: [...q.requires, id] })
            }}
          >
            <option value="">{T.addRequire}</option>
            {quests
              .filter((x) => x.id !== q.id && !q.requires.includes(x.id))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </div>
        {unlocks.length > 0 && (
          <p className="quests-small">
            {T.unlocks}:{' '}
            {unlocks.map((u, i) => (
              <span key={u.id}>
                {i > 0 && ', '}
                <button className="quests-link" onClick={() => onSelect(u.id)}>
                  {u.name}
                </button>
              </span>
            ))}
          </p>
        )}
        <ConditionsEditor label={T.startsIf} value={q.conditions} onChange={(conditions) => edit({ conditions })} />
        <ChangesEditor label={T.onDone} value={q.onComplete} onChange={(onComplete) => edit({ onComplete })} />
      </section>

      <label className="quests-field">
        {T.notes}
        <textarea className="input quests-text" value={q.notes} onChange={(e) => edit({ notes: e.target.value })} />
      </label>
    </aside>
  )
}
