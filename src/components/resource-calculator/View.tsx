import { ExternalLink, Plus, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { newId, type Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys, type UseDocumentResult } from '@/core/state'
import { openComponent } from '@/shell/editor/actions'
import { createLevelPresetDoc, normalizeLevelPresetDoc, NumberInput, PresetHeader, useEditSession, type LevelPresetDoc } from '@/shared/calculators'
import { formatNumber } from '@/shared/formulas'
import {
  createResourceDoc,
  formatDays,
  formatDuration,
  goalLevels,
  neededResources,
  normalizeResourceDoc,
  rankSources,
  sourcesForItem,
  type OtherSource,
  type ResourceDoc,
} from './logic'
import './resource-calculator.css'

const T = {
  kind: 'Resource plan',
  goal: 'Goal',
  goalLevel: 'Level something up',
  goalAmount: 'Collect an amount',
  levelPreset: 'Level preset',
  choosePreset: 'Choose a level preset…',
  noPresets: 'No level presets yet. Add level-up costs in the Level Calculator first.',
  missingPreset: 'This level preset was deleted.',
  openPreset: 'Open in Level Calculator',
  fromLevel: 'from level',
  toLevel: 'to level',
  presetRange: (a: number, b: number) => `The preset covers levels ${a} to ${b}.`,
  noCosts: 'This preset has no level-up costs with items. Add them in the Level Calculator.',
  brokenCosts: 'Some level-up cost formulas in the preset have errors and are left out.',
  item: 'Item',
  chooseItem: 'Choose an item…',
  amount: 'Amount',
  noItems: 'Add items in the Item List first.',
  settings: 'Player time',
  hoursPerDay: 'Play time per day (hours)',
  defaultKill: 'Seconds per kill when an enemy has no time to defeat',
  needs: 'Resources needed',
  nothingNeeded: 'Pick a goal to see what the player needs.',
  sources: 'Where to get it',
  noSources: 'Nothing drops this yet. Add it to an enemy drop table in the Enemy List, or add another source below.',
  colSource: 'Source',
  colPerRun: 'Per run',
  colTime: 'Time per run',
  colRuns: 'Runs needed',
  colPlay: 'Play time',
  colLimit: 'Runs per day',
  colDays: 'Days',
  never: 'Never drops',
  defaultTime: 'default',
  enemyTag: 'Enemy',
  otherTag: 'Other',
  fastest: 'Fastest',
  limitHint: 'Leave empty for no daily limit.',
  others: 'Other sources',
  othersHint: 'Chests, quests, shops, daily rewards: anything that is not an enemy.',
  addOther: 'Add source',
  otherName: 'Name',
  otherItem: 'Item',
  otherMin: 'Min',
  otherMax: 'Max',
  otherChance: 'Chance %',
  otherSeconds: 'Seconds per run',
  otherLimit: 'Runs per day',
  newOther: 'New source',
  remove: 'Remove',
  missing: 'Missing item',
}

export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<ResourceDoc>('resource-calculator', documentId!, createResourceDoc)
  useUndoRedoKeys(doc, active)
  if (!doc.data) return null
  return <ResourceCalculator documentId={documentId!} doc={doc} />
}

type Update = (fn: (d: ResourceDoc) => ResourceDoc) => void

export function ResourceCalculator({ documentId, doc: raw }: { documentId: Id; doc: UseDocumentResult<ResourceDoc> }) {
  const data = useMemo(() => normalizeResourceDoc(raw.data), [raw.data])
  const update: Update = (fn) => raw.update((d) => fn(normalizeResourceDoc(d)))
  const presetRef = useProjectStore((s) =>
    data.goal.levelPresetId ? s.meta?.documents.find((d) => d.id === data.goal.levelPresetId && d.type === 'level-calculator') : undefined,
  )
  const body = (preset: LevelPresetDoc | null) => (
    <div className="calc-root res-root">
      <PresetHeader documentId={documentId} kind={T.kind} undo={raw.undo} redo={raw.redo} canUndo={raw.canUndo} canRedo={raw.canRedo} />
      <ResourceBody data={data} update={update} raw={raw} preset={preset} />
    </div>
  )
  return data.goal.mode === 'level' && presetRef ? <WithLevelPreset id={presetRef.id}>{body}</WithLevelPreset> : body(null)
}

/** Loads a Level Calculator preset; it stays live, so changing its costs updates this plan (RC-4). */
function WithLevelPreset({ id, children }: { id: Id; children: (p: LevelPresetDoc | null) => ReactNode }) {
  const preset = useDocument<LevelPresetDoc>('level-calculator', id, createLevelPresetDoc)
  const data = useMemo(() => (preset.data ? normalizeLevelPresetDoc(preset.data) : null), [preset.data])
  return <>{children(data)}</>
}

function ResourceBody({ data, update, raw, preset }: { data: ResourceDoc; update: Update; raw: UseDocumentResult<ResourceDoc>; preset: LevelPresetDoc | null }) {
  const items = useProjectStore((s) => s.entities.item)
  const enemies = useProjectStore((s) => s.entities.enemy)
  const { needs, errors } = useMemo(() => neededResources(data, preset), [data, preset])
  const itemName = (id: Id) => items.find((i) => i.id === id)?.name ?? T.missing

  return (
    <div className="calc-scroll">
      <GoalSection data={data} update={update} preset={preset} brokenCosts={errors.length > 0} />
      <section className="calc-section">
        <h3>{T.settings}</h3>
        <div className="calc-row">
          <label className="calc-field">
            <span>{T.hoursPerDay}</span>
            <NumberInput value={data.hoursPerDay} min={0} max={24} onChange={(hoursPerDay) => update((d) => ({ ...d, hoursPerDay }))} />
          </label>
          <label className="calc-field">
            <span>{T.defaultKill}</span>
            <NumberInput value={data.defaultSecondsPerKill} min={0} onChange={(defaultSecondsPerKill) => update((d) => ({ ...d, defaultSecondsPerKill }))} />
          </label>
        </div>
      </section>

      <section className="calc-section">
        <h3>{T.needs}</h3>
        {needs.length === 0 ? (
          <p className="calc-muted">{T.nothingNeeded}</p>
        ) : (
          <div className="res-needs">
            {needs.map((n) => (
              <div key={n.itemId} className="res-need">
                <span className="calc-big">{formatNumber(n.amount)}</span> <span>{itemName(n.itemId)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {needs.map((n) => (
        <SourcesSection key={n.itemId} itemId={n.itemId} itemLabel={itemName(n.itemId)} needed={n.amount} data={data} update={update} enemies={enemies} />
      ))}

      <OtherSourcesSection data={data} update={update} raw={raw} />
    </div>
  )
}

function GoalSection({ data, update, preset, brokenCosts }: { data: ResourceDoc; update: Update; preset: LevelPresetDoc | null; brokenCosts: boolean }) {
  const documents = useProjectStore((s) => s.meta?.documents)
  const presets = useMemo(() => (documents ?? []).filter((d) => d.type === 'level-calculator'), [documents])
  const items = useProjectStore((s) => s.entities.item)
  const goal = data.goal
  const setGoal = (patch: Partial<ResourceDoc['goal']>) => update((d) => ({ ...d, goal: { ...d.goal, ...patch } }))
  const levels = goalLevels(data, preset)
  const missing = goal.levelPresetId && !presets.some((p) => p.id === goal.levelPresetId)
  const hasCosts = !!preset && preset.costs.some((c) => c.itemId)
  return (
    <section className="calc-section">
      <h3>
        {T.goal}
        <span className="calc-spacer" />
        <span className="calc-segmented">
          <button className={goal.mode === 'level' ? 'on' : ''} onClick={() => setGoal({ mode: 'level' })}>
            {T.goalLevel}
          </button>
          <button className={goal.mode === 'amount' ? 'on' : ''} onClick={() => setGoal({ mode: 'amount' })}>
            {T.goalAmount}
          </button>
        </span>
      </h3>
      {goal.mode === 'level' ? (
        presets.length === 0 ? (
          <p className="calc-muted">{T.noPresets}</p>
        ) : (
          <>
            <div className="calc-row">
              <select
                className="input calc-select"
                aria-label={T.levelPreset}
                value={goal.levelPresetId ?? ''}
                onChange={(e) => setGoal({ levelPresetId: e.target.value || null, fromLevel: null, toLevel: null })}
              >
                <option value="">{T.choosePreset}</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {goal.levelPresetId && !missing && (
                <button className="btn btn-ghost" onClick={() => openComponent('level-calculator', goal.levelPresetId)}>
                  <ExternalLink size={14} /> {T.openPreset}
                </button>
              )}
              {missing && <span className="calc-error">{T.missingPreset}</span>}
            </div>
            {preset && (
              <>
                <div className="calc-row">
                  <span className="calc-muted">{T.fromLevel}</span>
                  <NumberInput value={levels.from} min={1} onChange={(fromLevel) => setGoal({ fromLevel })} aria-label={T.fromLevel} />
                  <span className="calc-muted">{T.toLevel}</span>
                  <NumberInput value={levels.to} min={1} onChange={(toLevel) => setGoal({ toLevel })} aria-label={T.toLevel} />
                  <span className="calc-muted">{T.presetRange(preset.levelFrom, preset.levelTo)}</span>
                </div>
                {!hasCosts && <p className="calc-muted">{T.noCosts}</p>}
                {brokenCosts && <p className="calc-error">{T.brokenCosts}</p>}
              </>
            )}
          </>
        )
      ) : items.length === 0 ? (
        <p className="calc-muted">{T.noItems}</p>
      ) : (
        <div className="calc-row">
          <label className="calc-field">
            <span>{T.item}</span>
            <select className="input calc-select" value={goal.itemId ?? ''} onChange={(e) => setGoal({ itemId: e.target.value || null })}>
              <option value="">{T.chooseItem}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="calc-field">
            <span>{T.amount}</span>
            <NumberInput value={goal.amount} min={0} onChange={(amount) => setGoal({ amount })} />
          </label>
        </div>
      )}
    </section>
  )
}

function SourcesSection({
  itemId,
  itemLabel,
  needed,
  data,
  update,
  enemies,
}: {
  itemId: Id
  itemLabel: string
  needed: number
  data: ResourceDoc
  update: Update
  enemies: ResourceDocEnemies
}) {
  const ranked = rankSources(needed, sourcesForItem(itemId, enemies, data), data.hoursPerDay)
  const fastestKey = ranked[0]?.plan ? ranked[0].source.key : null
  const setLimit = (kind: 'enemy' | 'other', refId: Id, value: number | null) =>
    update((d) => {
      if (kind === 'other') return { ...d, otherSources: d.otherSources.map((o) => (o.id === refId ? { ...o, runsPerDay: value } : o)) }
      const next = { ...d.enemyRunsPerDay }
      if (value === null) delete next[refId]
      else next[refId] = value
      return { ...d, enemyRunsPerDay: next }
    })
  return (
    <section className="calc-section">
      <h3>
        {T.sources}: {formatNumber(needed)} {itemLabel}
      </h3>
      {ranked.length === 0 ? (
        <p className="calc-muted">{T.noSources}</p>
      ) : (
        <>
          <div className="calc-table-wrap">
            <table className="calc-table">
              <thead>
                <tr>
                  <th>{T.colSource}</th>
                  <th>{T.colPerRun}</th>
                  <th>{T.colTime}</th>
                  <th>{T.colRuns}</th>
                  <th>{T.colPlay}</th>
                  <th>{T.colLimit}</th>
                  <th>{T.colDays}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ source, plan }) => (
                  <tr key={source.key} className={source.key === fastestKey ? 'res-fastest' : undefined}>
                    <td className="calc-left">
                      <span className="res-tag">{source.kind === 'enemy' ? T.enemyTag : T.otherTag}</span> {source.name}
                      {source.key === fastestKey && (
                        <span className="res-best">
                          <Trophy size={12} /> {T.fastest}
                        </span>
                      )}
                    </td>
                    <td>{formatNumber(source.perRun, 3)}</td>
                    <td>
                      {formatDuration(source.secondsPerRun)}
                      {source.defaultTime && <span className="calc-muted"> ({T.defaultTime})</span>}
                    </td>
                    <td>{plan ? formatNumber(plan.runs) : T.never}</td>
                    <td>{plan ? formatDuration(plan.seconds) : '—'}</td>
                    <td>
                      <LimitInput value={source.runsPerDay} onChange={(v) => setLimit(source.kind, source.refId, v)} />
                    </td>
                    <td>{plan ? formatDays(plan.days) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="calc-muted res-hint">{T.limitHint}</p>
        </>
      )}
    </section>
  )
}

type ResourceDocEnemies = Parameters<typeof sourcesForItem>[1]

/** Runs per day; empty means no limit. Commits on blur so typing "1.5" does not save "1." first. */
function LimitInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value === null ? '' : String(value))
  return (
    <input
      className="input calc-number res-limit"
      type="number"
      min={0}
      aria-label={T.colLimit}
      value={shown}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text === null) return
        const n = Number(text)
        onChange(text.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : n)
        setText(null)
      }}
    />
  )
}

function OtherSourcesSection({ data, update, raw }: { data: ResourceDoc; update: Update; raw: UseDocumentResult<ResourceDoc> }) {
  const items = useProjectStore((s) => s.entities.item)
  const session = useEditSession(raw)
  const setRow = (id: Id, patch: Partial<OtherSource>) => update((d) => ({ ...d, otherSources: d.otherSources.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
  return (
    <section className="calc-section">
      <h3>{T.others}</h3>
      <p className="calc-muted res-hint">{T.othersHint}</p>
      {data.otherSources.length > 0 && (
        <div className="res-others">
          <span className="res-head">{T.otherName}</span>
          <span className="res-head">{T.otherItem}</span>
          <span className="res-head">{T.otherMin}</span>
          <span className="res-head">{T.otherMax}</span>
          <span className="res-head">{T.otherChance}</span>
          <span className="res-head">{T.otherSeconds}</span>
          <span className="res-head">{T.otherLimit}</span>
          <span />
          {data.otherSources.map((o) => (
            <div key={o.id} className="res-other-row">
              <input
                className="input"
                aria-label={T.otherName}
                value={o.name}
                onFocus={session.begin}
                onBlur={session.end}
                onChange={(e) => {
                  const name = e.target.value
                  session.change((d) => {
                    const n = normalizeResourceDoc(d)
                    return { ...n, otherSources: n.otherSources.map((x) => (x.id === o.id ? { ...x, name } : x)) }
                  })
                }}
              />
              <select className="input calc-select" aria-label={T.otherItem} value={o.itemId ?? ''} onChange={(e) => setRow(o.id, { itemId: e.target.value || null })}>
                <option value="">{T.chooseItem}</option>
                {o.itemId && !items.some((i) => i.id === o.itemId) && <option value={o.itemId}>{T.missing}</option>}
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <NumberInput value={o.amountMin} min={0} onChange={(amountMin) => setRow(o.id, { amountMin, amountMax: Math.max(amountMin, o.amountMax) })} aria-label={T.otherMin} />
              <NumberInput value={o.amountMax} min={0} onChange={(amountMax) => setRow(o.id, { amountMax })} aria-label={T.otherMax} />
              <NumberInput value={o.chancePercent} min={0} max={100} onChange={(chancePercent) => setRow(o.id, { chancePercent })} aria-label={T.otherChance} />
              <NumberInput value={o.secondsPerRun} min={0} onChange={(secondsPerRun) => setRow(o.id, { secondsPerRun })} aria-label={T.otherSeconds} />
              <LimitInput value={o.runsPerDay} onChange={(runsPerDay) => setRow(o.id, { runsPerDay })} />
              <button className="icon-btn" title={T.remove} aria-label={T.remove} onClick={() => update((d) => ({ ...d, otherSources: d.otherSources.filter((x) => x.id !== o.id) }))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div>
        <button
          className="btn"
          onClick={() =>
            update((d) => ({
              ...d,
              otherSources: [
                ...d.otherSources,
                { id: newId(), name: T.newOther, itemId: d.goal.itemId, amountMin: 1, amountMax: 1, chancePercent: 100, secondsPerRun: 60, runsPerDay: 1 },
              ],
            }))
          }
        >
          <Plus size={15} /> {T.addOther}
        </button>
      </div>
    </section>
  )
}
