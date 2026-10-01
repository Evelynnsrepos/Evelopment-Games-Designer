import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { newId, type Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys, type UseDocumentResult } from '@/core/state'
import { openComponent } from '@/shell/editor/actions'
import {
  costAtLevel,
  createDamagePresetDoc,
  createLevelPresetDoc,
  LineChart,
  normalizeDamagePresetDoc,
  normalizeLevelPresetDoc,
  NumberInput,
  PresetHeader,
  TARGET_VARIABLES,
  tryGrowthValue,
  useEditSession,
  type ChartSeries,
  type CostRow,
  type DamagePresetDoc,
  type GrowthMode,
  type GrowthRow,
  type LevelPresetDoc,
} from '@/shared/calculators'
import { defaultValues, formatNumber, getFormula, libraryFor, tryCompile } from '@/shared/formulas'
import { computeLevels, damageSource, numericCategoryStats, variableOrigins, type DamageSource, type LevelRow } from './compute'
import './level-calculator.css'

const T = {
  kind: 'Level preset',
  range: 'Levels',
  from: 'from',
  to: 'to',
  xp: 'XP curve',
  xpOn: 'Show XP',
  customXp: 'Custom formula',
  customXpHint: 'Use Level and any of your own variable names.',
  stats: 'Stat growth',
  statsHint: 'Values at level 1 and how they grow. Stat names are formula variables (ATK, DEF, HP, EM, ...).',
  statName: 'Stat',
  base: 'Level 1',
  growth: 'Growth',
  perLevel: 'Per level',
  atLevel: (l: number) => `At level ${l}`,
  addStat: 'Add stat',
  pull: 'Pull stats from…',
  characters: 'Characters',
  enemies: 'Enemies',
  items: 'Items',
  pulledFrom: (name: string) => `Stats pulled from ${name}.`,
  modes: { flat: 'Flat +', percent: '% (compounding)', formula: 'Formula' } as Record<GrowthMode, string>,
  formulaHint: 'Use Level and Base',
  remove: 'Remove',
  damage: 'Damage per level',
  damageNone: 'Off',
  damagePreset: 'Damage preset',
  damageFormula: 'Library formula',
  noPresets: 'No damage presets yet. Create one in the Damage Calculator.',
  choosePreset: 'Choose a preset…',
  missingPreset: 'This damage preset was deleted.',
  openPreset: 'Open in Damage Calculator',
  originLabel: { level: 'from the level', stat: 'from stat growth', target: 'from the target', input: '' },
  presetValue: 'set in the preset',
  target: 'Target',
  targetNone: 'None',
  targetFixed: 'Fixed values',
  targetEnemy: 'Enemy',
  targetFixedHint: 'Leave a value empty to use the formula input instead.',
  chooseEnemy: 'Choose an enemy…',
  noEnemies: 'Add enemies in the Enemy List to use them as targets.',
  enemyLevel: 'Enemy level',
  sameLevel: 'Same as attacker',
  fixedLevel: 'Fixed',
  costs: 'Level-up costs',
  costsHint: 'Materials needed to go from a level to the next. The Resource Calculator reads these.',
  chooseItem: 'Choose an item…',
  noItems: 'Add items in the Item List to use them as level-up materials.',
  addCost: 'Add material',
  results: 'Results',
  table: 'Table',
  chart: 'Chart',
  chartOf: { damage: 'Damage', xp: 'XP', stats: 'Stats' },
  colLevel: 'Level',
  colToNext: 'XP to next',
  colTotal: 'Total XP',
  colDamage: 'Damage',
  colHp: 'Target HP',
  colHits: 'Hits to defeat',
  total: (a: number, b: number) => `Total ${a} → ${b}`,
  noItem: 'No item',
  missing: 'Missing',
  nothing: 'Add stats, an XP curve, damage or costs to see results.',
}

export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<LevelPresetDoc>('level-calculator', documentId!, createLevelPresetDoc)
  useUndoRedoKeys(doc, active)
  if (!doc.data) return null
  return <LevelCalculator documentId={documentId!} doc={doc} />
}

type Update = (fn: (d: LevelPresetDoc) => LevelPresetDoc) => void

export function LevelCalculator({ documentId, doc: raw }: { documentId: Id; doc: UseDocumentResult<LevelPresetDoc> }) {
  const data = useMemo(() => normalizeLevelPresetDoc(raw.data), [raw.data])
  const update: Update = (fn) => raw.update((d) => fn(normalizeLevelPresetDoc(d)))
  const presetRef = useProjectStore((s) => (data.damage.presetId ? s.meta?.documents.find((d) => d.id === data.damage.presetId && d.type === 'damage-calculator') : undefined))
  const usePreset = data.damage.source === 'preset' && !!presetRef

  const body = (preset: { id: Id; name: string; data: DamagePresetDoc } | null) => (
    <div className="calc-root lvl-root">
      <PresetHeader documentId={documentId} kind={T.kind} undo={raw.undo} redo={raw.redo} canUndo={raw.canUndo} canRedo={raw.canRedo} />
      <LevelBody data={data} update={update} raw={raw} preset={preset} />
    </div>
  )
  return usePreset ? (
    <WithDamagePreset id={presetRef.id} name={presetRef.title}>
      {body}
    </WithDamagePreset>
  ) : (
    body(null)
  )
}

/** Loads a Damage Calculator preset; it stays live, so editing the preset updates this table (LV-4). */
function WithDamagePreset({ id, name, children }: { id: Id; name: string; children: (p: { id: Id; name: string; data: DamagePresetDoc } | null) => ReactNode }) {
  const preset = useDocument<DamagePresetDoc>('damage-calculator', id, createDamagePresetDoc)
  const data = useMemo(() => (preset.data ? normalizeDamagePresetDoc(preset.data) : null), [preset.data])
  return <>{children(data ? { id, name, data } : null)}</>
}

function LevelBody({ data, update, raw, preset }: { data: LevelPresetDoc; update: Update; raw: UseDocumentResult<LevelPresetDoc>; preset: { id: Id; name: string; data: DamagePresetDoc } | null }) {
  const enemies = useProjectStore((s) => s.entities.enemy)
  const enemy = (data.target.mode === 'enemy' && enemies.find((e) => e.id === data.target.enemyId)) || null
  const source = damageSource(data, preset)
  const { rows, damageError } = useMemo(() => computeLevels(data, source, enemy), [data, source, enemy])

  return (
    <div className="calc-scroll">
      <section className="calc-section">
        <h3>{T.range}</h3>
        <div className="calc-row">
          <span className="calc-muted">{T.from}</span>
          <NumberInput value={data.levelFrom} min={1} onChange={(levelFrom) => update((d) => ({ ...d, levelFrom }))} aria-label={`${T.range} ${T.from}`} />
          <span className="calc-muted">{T.to}</span>
          <NumberInput value={data.levelTo} min={1} onChange={(levelTo) => update((d) => ({ ...d, levelTo }))} aria-label={`${T.range} ${T.to}`} />
        </div>
      </section>
      <XpSection data={data} update={update} raw={raw} />
      <StatsSection data={data} update={update} raw={raw} />
      <DamageSection data={data} update={update} preset={preset} source={source} damageError={damageError} />
      <CostsSection data={data} update={update} raw={raw} />
      <ResultsSection data={data} update={update} rows={rows} source={source} />
    </div>
  )
}

function XpSection({ data, update, raw }: { data: LevelPresetDoc; update: Update; raw: UseDocumentResult<LevelPresetDoc> }) {
  const session = useEditSession(raw)
  const curves = libraryFor('level').find((g) => g.id === 'xp-curve')?.formulas ?? []
  const xp = data.xp
  const lib = xp.formulaId ? getFormula(xp.formulaId) : undefined
  const compiled = xp.formulaId === null ? tryCompile(xp.expression) : null
  const vars = lib ? lib.variables.filter((v) => v.name !== 'Level') : compiled?.ok ? compiled.value.variables.filter((v) => v !== 'Level').map((name) => ({ name, label: name })) : []
  const setXp = (patch: Partial<LevelPresetDoc['xp']>) => update((d) => ({ ...d, xp: { ...d.xp, ...patch } }))
  return (
    <section className="calc-section">
      <h3>
        {T.xp}
        <span className="calc-spacer" />
        <label className="lvl-check">
          <input type="checkbox" checked={xp.enabled} onChange={(e) => setXp({ enabled: e.target.checked })} /> {T.xpOn}
        </label>
      </h3>
      {xp.enabled && (
        <>
          <div className="calc-row">
            <select
              className="input calc-select"
              aria-label={T.xp}
              value={xp.formulaId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null
                const f = id ? getFormula(id) : undefined
                setXp({ formulaId: id, values: f ? { ...defaultValues(f), ...pickKnown(xp.values, f.variables.map((v) => v.name)) } : xp.values })
              }}
            >
              {curves.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value="">{T.customXp}</option>
            </select>
            {lib && <span className="calc-code">{lib.writtenForm}</span>}
          </div>
          {xp.formulaId === null && (
            <div className="calc-field">
              <input
                className="input lvl-mono"
                aria-label={T.customXp}
                value={xp.expression}
                spellCheck={false}
                onFocus={session.begin}
                onBlur={session.end}
                onChange={(e) => {
                  const expression = e.target.value
                  session.change((d) => ({ ...d, xp: { ...normalizeLevelPresetDoc(d).xp, expression } }))
                }}
              />
              {compiled && !compiled.ok ? <span className="calc-error">{compiled.error.message}</span> : <span className="calc-muted">{T.customXpHint}</span>}
            </div>
          )}
          {vars.length > 0 && (
            <div className="calc-row">
              {vars.map((v) => (
                <label key={v.name} className="calc-field">
                  <span>{v.label}</span>
                  <NumberInput value={xp.values[v.name] ?? ('defaultValue' in v ? v.defaultValue : 1)} onChange={(n) => setXp({ values: { ...xp.values, [v.name]: n } })} />
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function pickKnown(values: Record<string, number>, names: string[]) {
  return Object.fromEntries(Object.entries(values).filter(([k]) => names.includes(k)))
}

/** Editor for a growing value: base, mode and per-level amount or formula. Shared by stats and costs. */
function GrowthEditor<R extends GrowthRow>({ row, onChange, raw, field }: { row: R; onChange: (patch: Partial<R>) => void; raw: UseDocumentResult<LevelPresetDoc>; field: 'stats' | 'costs' }) {
  const session = useEditSession(raw)
  const err = row.mode === 'formula' ? tryCompile(row.expression) : null
  return (
    <>
      <NumberInput value={row.base} onChange={(base) => onChange({ base } as Partial<R>)} aria-label={T.base} />
      <select className="input calc-select" aria-label={T.growth} value={row.mode} onChange={(e) => onChange({ mode: e.target.value as GrowthMode } as Partial<R>)}>
        {(Object.keys(T.modes) as GrowthMode[]).map((m) => (
          <option key={m} value={m}>
            {T.modes[m]}
          </option>
        ))}
      </select>
      {row.mode === 'formula' ? (
        <span className="lvl-formula">
          <input
            className="input lvl-mono"
            placeholder={T.formulaHint}
            aria-label={T.growth}
            value={row.expression}
            spellCheck={false}
            onFocus={session.begin}
            onBlur={session.end}
            onChange={(e) => {
              const expression = e.target.value
              session.change((d) => {
                const n = normalizeLevelPresetDoc(d)
                return { ...n, [field]: (n[field] as GrowthRow[]).map((r) => (r.id === row.id ? { ...r, expression } : r)) }
              })
            }}
          />
          {err && !err.ok && row.expression.trim() !== '' && <span className="calc-error">{err.error.message}</span>}
        </span>
      ) : (
        <NumberInput value={row.perLevel} onChange={(perLevel) => onChange({ perLevel } as Partial<R>)} aria-label={T.perLevel} />
      )}
    </>
  )
}

function StatsSection({ data, update, raw }: { data: LevelPresetDoc; update: Update; raw: UseDocumentResult<LevelPresetDoc> }) {
  const entities = useProjectStore((s) => s.entities)
  const categories = useProjectStore((s) => s.categories)
  const session = useEditSession(raw)
  const setRow = (id: Id, patch: Partial<GrowthRow>) => update((d) => ({ ...d, stats: d.stats.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  const sourceName = data.statSource ? entities[data.statSource.type].find((e) => e.id === data.statSource!.id)?.name : undefined
  const lastLevel = Math.max(data.levelFrom, data.levelTo)

  const pull = (value: string) => {
    const [type, id] = value.split(':') as ['character' | 'enemy' | 'item', Id]
    const entity = entities[type]?.find((e) => e.id === id)
    if (!entity) return
    let stats: Record<string, number> = {}
    const growth: Record<string, { mode: 'flat' | 'percent'; perLevel: number }> = {}
    if (entity.type === 'enemy') {
      stats = entity.stats
      for (const g of entity.growth) growth[g.stat] = { mode: g.mode, perLevel: g.perLevel }
    } else if (entity.type === 'item') stats = entity.stats
    else if (entity.type === 'character') stats = numericCategoryStats(entity.categories, categories)
    update((d) => {
      const rows = [...d.stats]
      for (const [stat, base] of Object.entries(stats)) {
        const i = rows.findIndex((r) => r.stat.trim() === stat)
        const g = growth[stat]
        const patch = { base, ...(g ? { mode: g.mode, perLevel: g.perLevel } : {}) }
        if (i >= 0) rows[i] = { ...rows[i], ...patch }
        else rows.push({ id: newId(), stat, mode: 'flat', perLevel: 0, expression: '', ...patch })
      }
      return { ...d, stats: rows, statSource: { type, id } }
    })
  }

  const hasSources = entities.character.length + entities.enemy.length + entities.item.length > 0
  return (
    <section className="calc-section">
      <h3>
        {T.stats}
        <span className="calc-spacer" />
        {hasSources && (
          <select className="input calc-select" value="" aria-label={T.pull} onChange={(e) => e.target.value && pull(e.target.value)}>
            <option value="">{T.pull}</option>
            {(
              [
                ['character', T.characters],
                ['enemy', T.enemies],
                ['item', T.items],
              ] as const
            ).map(([type, label]) =>
              entities[type].length === 0 ? null : (
                <optgroup key={type} label={label}>
                  {entities[type].map((e) => (
                    <option key={e.id} value={`${type}:${e.id}`}>
                      {e.name}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
        )}
      </h3>
      <p className="calc-muted lvl-hint">
        {T.statsHint} {sourceName && T.pulledFrom(sourceName)}
      </p>
      {data.stats.length > 0 && (
        <div className="lvl-grid lvl-grid-stats">
          <span className="lvl-grid-head">{T.statName}</span>
          <span className="lvl-grid-head">{T.base}</span>
          <span className="lvl-grid-head">{T.growth}</span>
          <span className="lvl-grid-head">{T.perLevel}</span>
          <span className="lvl-grid-head">{T.atLevel(lastLevel)}</span>
          <span />
          {data.stats.map((row) => (
            <div key={row.id} className="lvl-grid-row">
              <input
                className="input lvl-stat"
                aria-label={T.statName}
                value={row.stat}
                spellCheck={false}
                onFocus={session.begin}
                onBlur={session.end}
                onChange={(e) => {
                  const stat = e.target.value.replace(/[^A-Za-z0-9_]/g, '')
                  session.change((d) => {
                    const n = normalizeLevelPresetDoc(d)
                    return { ...n, stats: n.stats.map((r) => (r.id === row.id ? { ...r, stat } : r)) }
                  })
                }}
              />
              <GrowthEditor row={row} raw={raw} field="stats" onChange={(p) => setRow(row.id, p)} />
              <span className="lvl-preview">{num(tryGrowthValue(row, lastLevel))}</span>
              <button className="icon-btn" title={T.remove} aria-label={T.remove} onClick={() => update((d) => ({ ...d, stats: d.stats.filter((r) => r.id !== row.id) }))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div>
        <button
          className="btn"
          onClick={() => update((d) => ({ ...d, stats: [...d.stats, { id: newId(), stat: d.stats.some((s) => s.stat === 'ATK') ? '' : 'ATK', base: 100, mode: 'flat', perLevel: 10, expression: '' }] }))}
        >
          <Plus size={15} /> {T.addStat}
        </button>
      </div>
    </section>
  )
}

function DamageSection({
  data,
  update,
  preset,
  source,
  damageError,
}: {
  data: LevelPresetDoc
  update: Update
  preset: { id: Id; name: string; data: DamagePresetDoc } | null
  source: DamageSource | null
  damageError: string | null
}) {
  const documents = useProjectStore((s) => s.meta?.documents)
  const presets = useMemo(() => (documents ?? []).filter((d) => d.type === 'damage-calculator'), [documents])
  const enemies = useProjectStore((s) => s.entities.enemy)
  const groups = libraryFor('damage')
  const dmg = data.damage
  const setDamage = (patch: Partial<LevelPresetDoc['damage']>) => update((d) => ({ ...d, damage: { ...d.damage, ...patch } }))
  const setTarget = (patch: Partial<LevelPresetDoc['target']>) => update((d) => ({ ...d, target: { ...d.target, ...patch } }))
  const compiled = source ? tryCompile(source.expression) : null
  const variables = compiled?.ok ? compiled.value.variables : []
  const origins = variableOrigins(variables, data)
  const lib = dmg.source === 'formula' ? getFormula(dmg.formulaId) : preset?.data.formulaId ? getFormula(preset.data.formulaId) : undefined
  const labelOf = (name: string) => lib?.variables.find((v) => v.name === name)?.label ?? name
  const usedTargets = TARGET_VARIABLES.filter((n) => variables.includes(n) || n === 'HP')
  const presetMissing = dmg.source === 'preset' && dmg.presetId && !presets.some((p) => p.id === dmg.presetId)

  return (
    <section className="calc-section">
      <h3>
        {T.damage}
        <span className="calc-spacer" />
        <span className="calc-segmented">
          {(['none', 'preset', 'formula'] as const).map((s) => (
            <button key={s} className={dmg.source === s ? 'on' : ''} onClick={() => setDamage({ source: s })}>
              {s === 'none' ? T.damageNone : s === 'preset' ? T.damagePreset : T.damageFormula}
            </button>
          ))}
        </span>
      </h3>
      {dmg.source === 'preset' &&
        (presets.length === 0 ? (
          <p className="calc-muted">{T.noPresets}</p>
        ) : (
          <div className="calc-row">
            <select className="input calc-select" aria-label={T.damagePreset} value={dmg.presetId ?? ''} onChange={(e) => setDamage({ presetId: e.target.value || null })}>
              <option value="">{T.choosePreset}</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {preset && (
              <button className="btn btn-ghost" onClick={() => openComponent('damage-calculator', preset.id)}>
                <ExternalLink size={14} /> {T.openPreset}
              </button>
            )}
            {presetMissing && <span className="calc-error">{T.missingPreset}</span>}
          </div>
        ))}
      {dmg.source === 'formula' && (
        <div className="calc-row">
          <select
            className="input calc-select"
            aria-label={T.damageFormula}
            value={dmg.formulaId}
            onChange={(e) => {
              const f = getFormula(e.target.value)
              if (f) setDamage({ formulaId: f.id, values: { ...defaultValues(f), ...pickKnown(dmg.values, f.variables.map((v) => v.name)) } })
            }}
          >
            {groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.formulas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {lib && <span className="calc-code">{lib.writtenForm}</span>}
        </div>
      )}
      {damageError && <div className="calc-error">{damageError}</div>}
      {source && variables.length > 0 && (
        <div className="lvl-vars">
          {variables.map((name) => (
            <label key={name} className="calc-field">
              <span>
                {labelOf(name)} {labelOf(name) !== name && <code>{name}</code>}
              </span>
              {origins[name] !== 'input' ? (
                <em className="lvl-origin">{T.originLabel[origins[name]]}</em>
              ) : dmg.source === 'formula' ? (
                <NumberInput value={dmg.values[name] ?? 0} onChange={(n) => setDamage({ values: { ...dmg.values, [name]: n } })} />
              ) : (
                <em className="lvl-origin">
                  {formatNumber(source.values[name] ?? 0)} ({T.presetValue})
                </em>
              )}
            </label>
          ))}
        </div>
      )}

      {source && (
        <div className="lvl-target">
          <div className="calc-row">
            <strong>{T.target}</strong>
            <span className="calc-segmented">
              {(['none', 'fixed', 'enemy'] as const).map((m) => (
                <button key={m} className={data.target.mode === m ? 'on' : ''} onClick={() => setTarget({ mode: m })}>
                  {m === 'none' ? T.targetNone : m === 'fixed' ? T.targetFixed : T.targetEnemy}
                </button>
              ))}
            </span>
          </div>
          {data.target.mode === 'fixed' && (
            <>
              <div className="calc-row">
                {usedTargets.map((name) => (
                  <label key={name} className="calc-field">
                    <span>{name}</span>
                    <OptionalNumber
                      value={data.target.values[name]}
                      onChange={(n) =>
                        setTarget({
                          values: n === undefined ? Object.fromEntries(Object.entries(data.target.values).filter(([k]) => k !== name)) : { ...data.target.values, [name]: n },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="calc-muted lvl-hint">{T.targetFixedHint}</p>
            </>
          )}
          {data.target.mode === 'enemy' &&
            (enemies.length === 0 ? (
              <p className="calc-muted">{T.noEnemies}</p>
            ) : (
              <div className="calc-row">
                <select className="input calc-select" aria-label={T.targetEnemy} value={data.target.enemyId ?? ''} onChange={(e) => setTarget({ enemyId: e.target.value || null })}>
                  <option value="">{T.chooseEnemy}</option>
                  {enemies.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <span className="calc-muted">{T.enemyLevel}</span>
                <select
                  className="input calc-select"
                  aria-label={T.enemyLevel}
                  value={data.target.enemyLevel === null ? 'same' : 'fixed'}
                  onChange={(e) => {
                    const enemy = enemies.find((x) => x.id === data.target.enemyId)
                    setTarget({ enemyLevel: e.target.value === 'same' ? null : (enemy?.levelMin ?? 1) })
                  }}
                >
                  <option value="same">{T.sameLevel}</option>
                  <option value="fixed">{T.fixedLevel}</option>
                </select>
                {data.target.enemyLevel !== null && <NumberInput value={data.target.enemyLevel} min={1} onChange={(n) => setTarget({ enemyLevel: n })} aria-label={T.enemyLevel} />}
              </div>
            ))}
        </div>
      )}
    </section>
  )
}

/** A number field that may be empty (undefined). */
function OptionalNumber({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <input
      className="input calc-number"
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value.trim() === '' || !Number.isFinite(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)}
    />
  )
}

function CostsSection({ data, update, raw }: { data: LevelPresetDoc; update: Update; raw: UseDocumentResult<LevelPresetDoc> }) {
  const items = useProjectStore((s) => s.entities.item)
  const setRow = (id: Id, patch: Partial<CostRow>) => update((d) => ({ ...d, costs: d.costs.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  const lastLevel = Math.max(data.levelFrom, data.levelTo)
  return (
    <section className="calc-section">
      <h3>{T.costs}</h3>
      <p className="calc-muted lvl-hint">{T.costsHint}</p>
      {items.length === 0 && <p className="calc-muted">{T.noItems}</p>}
      {data.costs.length > 0 && (
        <div className="lvl-grid lvl-grid-stats">
          <span className="lvl-grid-head">{T.items}</span>
          <span className="lvl-grid-head">{T.base}</span>
          <span className="lvl-grid-head">{T.growth}</span>
          <span className="lvl-grid-head">{T.perLevel}</span>
          <span className="lvl-grid-head">{T.atLevel(lastLevel)}</span>
          <span />
          {data.costs.map((row) => (
            <div key={row.id} className="lvl-grid-row">
              <select className="input calc-select lvl-stat" aria-label={T.items} value={row.itemId ?? ''} onChange={(e) => setRow(row.id, { itemId: e.target.value || null })}>
                <option value="">{T.chooseItem}</option>
                {row.itemId && !items.some((i) => i.id === row.itemId) && <option value={row.itemId}>{T.missing}</option>}
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <GrowthEditor row={row} raw={raw} field="costs" onChange={(p) => setRow(row.id, p)} />
              <span className="lvl-preview">{num(costAtLevel(row, lastLevel))}</span>
              <button className="icon-btn" title={T.remove} aria-label={T.remove} onClick={() => update((d) => ({ ...d, costs: d.costs.filter((r) => r.id !== row.id) }))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div>
        <button
          className="btn"
          disabled={items.length === 0}
          onClick={() => update((d) => ({ ...d, costs: [...d.costs, { id: newId(), stat: '', itemId: null, base: 10, mode: 'flat', perLevel: 0, expression: '' }] }))}
        >
          <Plus size={15} /> {T.addCost}
        </button>
      </div>
    </section>
  )
}

function ResultsSection({ data, update, rows, source }: { data: LevelPresetDoc; update: Update; rows: LevelRow[]; source: DamageSource | null }) {
  const items = useProjectStore((s) => s.entities.item)
  const statNames = [...new Set(data.stats.map((s) => s.stat.trim()).filter(Boolean))]
  const showXp = data.xp.enabled
  const showDamage = !!source
  const showHp = showDamage && rows.some((r) => r.targetHp !== null)
  const costCols = data.costs.map((c) => ({ id: c.id, label: c.itemId ? (items.find((i) => i.id === c.itemId)?.name ?? T.missing) : T.noItem }))
  if (!showXp && !showDamage && statNames.length === 0 && costCols.length === 0) {
    return (
      <section className="calc-section">
        <h3>{T.results}</h3>
        <p className="calc-muted">{T.nothing}</p>
      </section>
    )
  }

  const xs = rows.map((r) => r.level)
  const chartModes = (['damage', 'xp', 'stats'] as const).filter((m) => (m === 'damage' ? showDamage : m === 'xp' ? showXp : statNames.length > 0))
  const chart = chartModes.includes(data.chart) ? data.chart : chartModes[0]
  const series: ChartSeries[] =
    chart === 'xp'
      ? [
          { name: T.colToNext, values: rows.map((r) => r.toNext) },
          { name: T.colTotal, values: rows.map((r) => r.totalXp) },
        ]
      : chart === 'stats'
        ? statNames.map((n) => ({ name: n, values: rows.map((r) => r.stats[n] ?? null) }))
        : [{ name: source?.resultLabel ?? T.colDamage, values: rows.map((r) => r.damage) }]
  const first = rows[0]?.level ?? 1
  const last = rows[rows.length - 1]?.level ?? 1
  const sum = (pick: (r: LevelRow) => number | null) => {
    let s = 0
    for (const r of rows.slice(0, -1)) {
      const v = pick(r)
      if (v === null) return null
      s += v
    }
    return s
  }

  return (
    <section className="calc-section">
      <h3>
        {T.results}
        <span className="calc-spacer" />
        {chartModes.length > 0 && (
          <span className="calc-segmented">
            {chartModes.map((m) => (
              <button key={m} className={chart === m ? 'on' : ''} onClick={() => update((d) => ({ ...d, chart: m }))}>
                {T.chartOf[m]}
              </button>
            ))}
          </span>
        )}
      </h3>
      {chart && <LineChart xs={xs} series={series} xLabel={T.colLevel} />}
      <div className="calc-table-wrap">
        <table className="calc-table">
          <thead>
            <tr>
              <th>{T.colLevel}</th>
              {showXp && <th>{T.colToNext}</th>}
              {showXp && <th>{T.colTotal}</th>}
              {statNames.map((n) => (
                <th key={n}>{n}</th>
              ))}
              {showDamage && <th>{source!.resultLabel}</th>}
              {showHp && <th>{T.colHp}</th>}
              {showHp && <th>{T.colHits}</th>}
              {costCols.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.level}>
                <td>{r.level}</td>
                {showXp && <td>{num(r.toNext)}</td>}
                {showXp && <td>{num(r.totalXp)}</td>}
                {statNames.map((n) => (
                  <td key={n}>{num(r.stats[n] ?? null)}</td>
                ))}
                {showDamage && <td title={r.damageError}>{num(r.damage)}</td>}
                {showHp && <td>{num(r.targetHp)}</td>}
                {showHp && <td>{num(r.hits)}</td>}
                {costCols.map((c) => (
                  <td key={c.id}>{num(r.costs[c.id])}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (showXp || costCols.length > 0) && (
            <tfoot>
              <tr className="lvl-total">
                <td>{T.total(first, last)}</td>
                {showXp && <td />}
                {showXp && <td>{num(rows[rows.length - 1].totalXp)}</td>}
                {statNames.map((n) => (
                  <td key={n} />
                ))}
                {showDamage && <td />}
                {showHp && <td />}
                {showHp && <td />}
                {costCols.map((c) => (
                  <td key={c.id}>{num(sum((r) => r.costs[c.id]))}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatNumber(v))
