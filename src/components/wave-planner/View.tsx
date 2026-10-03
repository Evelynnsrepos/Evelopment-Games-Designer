import { Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import type { Enemy, Item } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys } from '@/core/state'
import { LineChart, NumberInput, PresetHeader } from '@/shared/calculators'
import { formatNumber } from '@/shared/formulas'
import { computeWaves, createWaveDoc, MAX_WAVES, newGroup, normalizeWaveDoc, weaponReach, type EnemyGroup, type WaveDoc } from './logic'
import './wave-planner.css'

const T = {
  kind: 'Wave plan',
  setup: 'Waves',
  waves: 'Number of waves',
  timeBase: 'Seconds for wave 1',
  timePerWave: 'Seconds added per wave',
  healthGrowth: 'Enemy health grows',
  growthPercent: '% per wave',
  growthFlat: 'flat per wave',
  growthLevel: "by the enemy's own level growth (wave = level)",
  healthStat: 'Health stat of enemies',
  dropGrowth: 'Drop chance per wave (+%)',
  enemies: 'Enemies',
  enemy: 'Enemy',
  custom: 'Custom enemy',
  name: 'Name',
  health: 'Health',
  count: 'Count in first wave',
  perWave: 'More per wave',
  from: 'From wave',
  to: 'To wave',
  every: 'Every … waves',
  addGroup: 'Add enemies',
  noGroups: 'Add the enemies of your waves: from the Enemy List or custom ones. A boss can appear every fifth wave with "Every 5 waves".',
  noHealth: (stat: string) => `No "${stat}" stat`,
  chart: 'Damage per second needed and total health',
  weapons: 'Weapons',
  weaponStat: 'Item stat with damage per second',
  weaponHint: 'Pick the weapons to check. Each one clears waves while its damage per second is at least what the wave needs.',
  noItems: (stat: string) => `No item has a "${stat}" stat yet. Add it under Numbers in the Item List.`,
  clears: (n: number, total: number) => (n >= total ? `clears all ${total} waves` : n === 0 ? 'cannot clear wave 1' : `clears up to wave ${n}`),
  table: 'Wave by wave',
  wave: 'Wave',
  time: 'Time',
  enemyCol: 'Enemies',
  totalHealth: 'Total health',
  dps: 'DPS needed',
  drops: 'Expected drops',
  dropX: 'Drop ×',
}

/** Wave Planner (v0.7): waves, enemy health over rounds, drop scaling and the DPS needed to beat each wave. */
export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<WaveDoc>('wave-planner', documentId!, createWaveDoc)
  useUndoRedoKeys(doc, active)
  const enemies = useProjectStore((s) => s.entities.enemy) as Enemy[]
  const items = useProjectStore((s) => s.entities.item) as Item[]
  const d = doc.data ? normalizeWaveDoc(doc.data) : null
  const rows = useMemo(() => (d ? computeWaves(d, enemies) : []), [d, enemies])
  if (!d) return null
  const set = (patch: Partial<WaveDoc>) => doc.update((x) => ({ ...normalizeWaveDoc(x), ...patch }))
  const setGroup = (id: string, patch: Partial<EnemyGroup>) => set({ groups: d.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })
  const itemName = (id: string) => items.find((i) => i.id === id)?.name || 'Item'
  const weapons = items.filter((i) => d.weaponIds.includes(i.id))
  const reach = weaponReach(rows, weapons, d.weaponStat)
  const growthMode = d.healthGrowth.mode
  const withStat = items.filter((i) => Object.keys(i.stats).some((k) => k.toLowerCase() === d.weaponStat.trim().toLowerCase()))

  return (
    <div className="calc-root wave-root">
      <div className="calc-scroll">
        <PresetHeader documentId={documentId!} kind={T.kind} undo={doc.undo} redo={doc.redo} canUndo={doc.canUndo} canRedo={doc.canRedo} />

        <section className="calc-section">
          <h3>{T.setup}</h3>
          <div className="wave-grid">
            <label className="calc-field">
              {T.waves}
              <NumberInput value={d.waves} min={1} max={MAX_WAVES} step={1} onChange={(waves) => set({ waves })} />
            </label>
            <label className="calc-field">
              {T.timeBase}
              <NumberInput value={d.timeBase} min={0} onChange={(timeBase) => set({ timeBase })} />
            </label>
            <label className="calc-field">
              {T.timePerWave}
              <NumberInput value={d.timePerWave} onChange={(timePerWave) => set({ timePerWave })} />
            </label>
            <label className="calc-field">
              {T.healthStat}
              <input className="input" value={d.healthStat} onChange={(e) => set({ healthStat: e.target.value })} />
            </label>
            <label className="calc-field">
              {T.dropGrowth}
              <NumberInput value={d.dropGrowthPercent} onChange={(dropGrowthPercent) => set({ dropGrowthPercent })} />
            </label>
            <div className="calc-field">
              {T.healthGrowth}
              <span className="wave-inline">
                {growthMode !== 'level' && (
                  <NumberInput value={'perWave' in d.healthGrowth ? d.healthGrowth.perWave : 0} onChange={(perWave) => set({ healthGrowth: { mode: growthMode, perWave } })} />
                )}
                <select
                  className="input"
                  value={growthMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'percent' | 'flat' | 'level'
                    set({ healthGrowth: mode === 'level' ? { mode } : { mode, perWave: d.healthGrowth.mode === 'level' ? 10 : d.healthGrowth.perWave } })
                  }}
                >
                  <option value="percent">{T.growthPercent}</option>
                  <option value="flat">{T.growthFlat}</option>
                  <option value="level">{T.growthLevel}</option>
                </select>
              </span>
            </div>
          </div>
        </section>

        <section className="calc-section">
          <h3>{T.enemies}</h3>
          {d.groups.length === 0 && <p className="calc-muted">{T.noGroups}</p>}
          {d.groups.length > 0 && (
            <div className="calc-table-wrap">
              <table className="calc-table wave-groups">
                <thead>
                  <tr>
                    <th>{T.enemy}</th>
                    <th>{T.health}</th>
                    <th>{T.count}</th>
                    <th>{T.perWave}</th>
                    <th>{T.from}</th>
                    <th>{T.to}</th>
                    <th>{T.every}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.groups.map((g) => {
                    const enemy = enemies.find((e) => e.id === g.enemyId)
                    const hp = enemy ? Object.entries(enemy.stats).find(([k]) => k.toLowerCase() === d.healthStat.trim().toLowerCase())?.[1] : undefined
                    return (
                      <tr key={g.id}>
                        <td>
                          <span className="wave-inline">
                            <select
                              className="input"
                              value={g.enemyId ?? ''}
                              onChange={(e) => setGroup(g.id, { enemyId: e.target.value || null })}
                            >
                              <option value="">{T.custom}</option>
                              {enemies.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.name || 'Untitled enemy'}
                                </option>
                              ))}
                            </select>
                            {!g.enemyId && <input className="input" placeholder={T.name} value={g.name} onChange={(e) => setGroup(g.id, { name: e.target.value })} />}
                          </span>
                        </td>
                        <td>
                          {g.enemyId ? (
                            hp === undefined ? (
                              <span className="calc-error">{T.noHealth(d.healthStat)}</span>
                            ) : (
                              formatNumber(hp)
                            )
                          ) : (
                            <NumberInput value={g.health} min={0} onChange={(health) => setGroup(g.id, { health })} />
                          )}
                        </td>
                        <td>
                          <NumberInput value={g.countBase} min={0} onChange={(countBase) => setGroup(g.id, { countBase })} />
                        </td>
                        <td>
                          <NumberInput value={g.countPerWave} onChange={(countPerWave) => setGroup(g.id, { countPerWave })} />
                        </td>
                        <td>
                          <NumberInput value={g.fromWave} min={1} step={1} onChange={(fromWave) => setGroup(g.id, { fromWave: Math.max(1, Math.floor(fromWave)) })} />
                        </td>
                        <td>
                          <input
                            className="input calc-number"
                            type="number"
                            placeholder="end"
                            value={g.toWave ?? ''}
                            onChange={(e) => setGroup(g.id, { toWave: e.target.value === '' ? null : Math.max(1, Math.floor(Number(e.target.value))) })}
                          />
                        </td>
                        <td>
                          <NumberInput value={g.every} min={1} step={1} onChange={(every) => setGroup(g.id, { every: Math.max(1, Math.floor(every)) })} />
                        </td>
                        <td>
                          <button className="icon-btn" title="Remove" onClick={() => set({ groups: d.groups.filter((x) => x.id !== g.id) })}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <button className="btn" onClick={() => set({ groups: [...d.groups, newGroup(enemies[0])] })}>
            <Plus size={14} /> {T.addGroup}
          </button>
        </section>

        {rows.length > 0 && d.groups.length > 0 && (
          <section className="calc-section">
            <h3>{T.chart}</h3>
            <LineChart
              xs={rows.map((r) => r.wave)}
              xLabel={T.wave}
              series={[
                { name: T.dps, values: rows.map((r) => (Number.isFinite(r.dps) ? r.dps : null)) },
                { name: T.totalHealth, values: rows.map((r) => r.totalHealth) },
              ]}
            />
          </section>
        )}

        <section className="calc-section">
          <h3>{T.weapons}</h3>
          <label className="calc-field wave-stat">
            {T.weaponStat}
            <input className="input" value={d.weaponStat} onChange={(e) => set({ weaponStat: e.target.value })} />
          </label>
          <p className="calc-muted">{T.weaponHint}</p>
          {withStat.length === 0 ? (
            <p className="calc-muted">{T.noItems(d.weaponStat)}</p>
          ) : (
            <div className="wave-weapons">
              {withStat.map((i) => {
                const on = d.weaponIds.includes(i.id)
                const r = reach.find((x) => x.item.id === i.id)
                return (
                  <label key={i.id} className={`wave-weapon${on ? ' on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => set({ weaponIds: on ? d.weaponIds.filter((x) => x !== i.id) : [...d.weaponIds, i.id] })} />
                    <span className="wave-weapon-name">{i.name || 'Untitled item'}</span>
                    <span className="calc-muted">{formatNumber(r?.dps ?? Object.entries(i.stats).find(([k]) => k.toLowerCase() === d.weaponStat.trim().toLowerCase())?.[1] ?? 0)} DPS</span>
                    {r && <span className={r.lastWave >= rows.length ? 'wave-ok' : 'wave-short'}>{T.clears(r.lastWave, rows.length)}</span>}
                  </label>
                )
              })}
            </div>
          )}
        </section>

        {rows.length > 0 && d.groups.length > 0 && (
          <section className="calc-section">
            <h3>{T.table}</h3>
            <div className="calc-table-wrap">
              <table className="calc-table">
                <thead>
                  <tr>
                    <th>{T.wave}</th>
                    <th>{T.time}</th>
                    <th>{T.enemyCol}</th>
                    <th>{T.totalHealth}</th>
                    <th>{T.dps}</th>
                    <th>{T.dropX}</th>
                    <th>{T.drops}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.wave}>
                      <td>{r.wave}</td>
                      <td>{formatNumber(r.seconds)} s</td>
                      <td>{r.groups.map((g) => `${g.count}× ${g.name}`).join(', ') || '—'}</td>
                      <td>{formatNumber(r.totalHealth)}</td>
                      <td className="calc-big">{Number.isFinite(r.dps) ? formatNumber(r.dps) : '∞'}</td>
                      <td>{formatNumber(r.dropMultiplier)}</td>
                      <td>{r.drops.map((x) => `${formatNumber(x.amount)} ${itemName(x.itemId)}`).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
