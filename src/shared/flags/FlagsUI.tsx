import { Plus, X } from 'lucide-react'
import { promptDialog } from '../dialogs'
import { OPS, toFlagName, useFlags, type Condition, type Flag, type FlagChange } from './flags'
import './flags.css'

const T = {
  title: 'Flags and variables',
  hint: 'Game-state values that quests and dialogue check and change, like met_the_king (yes/no) or gold (a number). Shared by the Quest Designer and the Dialogue Editor.',
  add: 'New flag',
  name: 'Name of the flag or variable, e.g. met_the_king',
  bool: 'Yes / no',
  number: 'Number',
  start: 'Starts at',
  note: 'Note',
  none: 'No flags yet.',
  addCondition: 'Add condition',
  addChange: 'Add change',
  pick: 'Pick a flag…',
}

/** The project's list of flags and variables. */
export function FlagsEditor() {
  const { flags, add, update, remove } = useFlags()
  return (
    <div className="flags">
      <div className="flags-head">
        <strong>{T.title}</strong>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const name = (await promptDialog(T.name, ''))?.trim()
            if (name) add(name)
          }}
        >
          <Plus size={14} /> {T.add}
        </button>
      </div>
      <p className="muted flags-hint">{T.hint}</p>
      {flags.length === 0 && <p className="muted">{T.none}</p>}
      {flags.map((f) => (
        <div key={f.id} className="flags-row">
          <input className="input flags-name" value={f.name} onChange={(e) => update(f.id, { name: toFlagName(e.target.value) || f.name })} />
          <select className="input" value={f.kind} onChange={(e) => update(f.id, { kind: e.target.value as Flag['kind'], initial: 0 })}>
            <option value="bool">{T.bool}</option>
            <option value="number">{T.number}</option>
          </select>
          <span className="muted">{T.start}</span>
          {f.kind === 'bool' ? (
            <select className="input" value={f.initial ? '1' : '0'} onChange={(e) => update(f.id, { initial: Number(e.target.value) })}>
              <option value="0">no</option>
              <option value="1">yes</option>
            </select>
          ) : (
            <input className="input flags-num" type="number" value={f.initial} onChange={(e) => update(f.id, { initial: Number(e.target.value) || 0 })} />
          )}
          <input className="input flags-note" placeholder={T.note} value={f.note} onChange={(e) => update(f.id, { note: e.target.value })} />
          <button className="icon-btn" title="Delete flag" onClick={() => remove(f.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function FlagSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { flags, add } = useFlags()
  return (
    <select
      className="input"
      value={value}
      onChange={async (e) => {
        if (e.target.value === '__new') {
          const name = (await promptDialog(T.name, ''))?.trim()
          if (name) onChange(add(name).id)
          return
        }
        onChange(e.target.value)
      }}
    >
      <option value="">{T.pick}</option>
      {flags.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
      <option value="__new">New flag…</option>
    </select>
  )
}

/** Value input that fits the flag: yes/no or a number. */
function FlagValue({ flagId, value, onChange }: { flagId: string; value: number; onChange: (v: number) => void }) {
  const { flags } = useFlags()
  const f = flags.find((x) => x.id === flagId)
  if (f?.kind === 'bool')
    return (
      <select className="input" value={value ? '1' : '0'} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="1">yes</option>
        <option value="0">no</option>
      </select>
    )
  return <input className="input flags-num" type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
}

/** A list of conditions ("only if…"). */
export function ConditionsEditor({ value, onChange, label }: { value: Condition[]; onChange: (next: Condition[]) => void; label: string }) {
  const { flags } = useFlags()
  return (
    <div className="flags-list">
      <span className="flags-label">{label}</span>
      {value.map((c, i) => {
        const f = flags.find((x) => x.id === c.flagId)
        const set = (patch: Partial<Condition>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)))
        return (
          <div key={i} className="flags-row">
            <FlagSelect value={c.flagId} onChange={(flagId) => set({ flagId })} />
            {f?.kind !== 'bool' && (
              <select className="input flags-op" value={c.op} onChange={(e) => set({ op: e.target.value as Condition['op'] })}>
                {OPS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
            <FlagValue flagId={c.flagId} value={c.value} onChange={(v) => set({ value: v, op: f?.kind === 'bool' ? '==' : c.op })} />
            <button className="icon-btn" title="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <X size={13} />
            </button>
          </div>
        )
      })}
      <button className="btn btn-ghost flags-add" onClick={() => onChange([...value, { flagId: '', op: '==', value: 1 }])}>
        <Plus size={13} /> {T.addCondition}
      </button>
    </div>
  )
}

/** A list of flag changes ("then set…"). */
export function ChangesEditor({ value, onChange, label }: { value: FlagChange[]; onChange: (next: FlagChange[]) => void; label: string }) {
  const { flags } = useFlags()
  return (
    <div className="flags-list">
      <span className="flags-label">{label}</span>
      {value.map((c, i) => {
        const f = flags.find((x) => x.id === c.flagId)
        const set = (patch: Partial<FlagChange>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)))
        return (
          <div key={i} className="flags-row">
            <FlagSelect value={c.flagId} onChange={(flagId) => set({ flagId })} />
            {f?.kind !== 'bool' && (
              <select className="input flags-op" value={c.op} onChange={(e) => set({ op: e.target.value as FlagChange['op'] })}>
                <option value="set">=</option>
                <option value="add">+=</option>
              </select>
            )}
            <FlagValue flagId={c.flagId} value={c.value} onChange={(v) => set({ value: v, op: f?.kind === 'bool' ? 'set' : c.op })} />
            <button className="icon-btn" title="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <X size={13} />
            </button>
          </div>
        )
      })}
      <button className="btn btn-ghost flags-add" onClick={() => onChange([...value, { flagId: '', op: 'set', value: 1 }])}>
        <Plus size={13} /> {T.addChange}
      </button>
    </div>
  )
}
