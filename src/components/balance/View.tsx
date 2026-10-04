import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Enemy, Entity, EntityType, Item } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import { LineChart } from '@/shared/calculators'
import { entityLook } from '@/shared/categories'
import { openEntity } from '@/shared/entityList'
import { formatNumber } from '@/shared/formulas'
import '@/shared/listDetail/listDetail.css'
import { curve, outliers, type Point } from './model'
import './balance.css'

/** Balance dashboard (v0.10): outliers in item and enemy numbers, and the enemy difficulty curve. */
export default function View(_props: PanelProps) {
  const entities = useProjectStore((s) => s.entities)
  const categories = useProjectStore((s) => s.categories)
  const items = entities.item as Item[]
  const enemies = entities.enemy as Enemy[]
  const [stat, setStat] = useState('')

  const enemyStats = useMemo(() => [...new Set(enemies.flatMap((e) => Object.keys(e.stats)))].sort(), [enemies])
  const chosen = stat && enemyStats.includes(stat) ? stat : (enemyStats[0] ?? '')

  const flagged = useMemo(() => {
    const group = (type: EntityType, e: Entity) => entityLook(categories, type, e)?.value ?? 'all'
    const out: (Point & { score: number; typical: number; stat: string; type: EntityType })[] = []
    for (const [type, list] of [
      ['item', items],
      ['enemy', enemies],
    ] as const) {
      const stats = [...new Set(list.flatMap((e) => Object.keys(e.stats)))]
      for (const s of stats) {
        const points = list.filter((e) => typeof e.stats[s] === 'number').map((e) => ({ id: e.id, name: e.name || 'Untitled', value: e.stats[s], group: `${type}:${group(type, e)}` }))
        for (const o of outliers(points)) out.push({ ...o, stat: s, type })
      }
    }
    return out.sort((a, b) => b.score - a.score)
  }, [items, enemies, categories])

  const c = useMemo(() => curve(enemies.filter((e) => typeof e.stats[chosen] === 'number').map((e) => ({ id: e.id, name: e.name, value: e.stats[chosen], group: 'all', level: e.levelMin }))), [enemies, chosen])
  const noStats = [...items.filter((i) => !Object.keys(i.stats).length), ...enemies.filter((e) => !Object.keys(e.stats).length)]
  const noDrops = enemies.filter((e) => !e.dropTable.length)

  return (
    <div className="bal">
      <section>
        <h3>Numbers that stick out</h3>
        <p className="muted">Each stat is compared with the other items or enemies of the same rarity. Values far from the typical one are listed, the most extreme first.</p>
        {flagged.length === 0 ? (
          <p>Nothing sticks out. (Groups need at least four entries with that stat.)</p>
        ) : (
          <table className="calc-table bal-table">
            <thead>
              <tr>
                <th>Entry</th>
                <th>Stat</th>
                <th>Value</th>
                <th>Typical in its group</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {flagged.slice(0, 50).map((o) => (
                <tr key={`${o.id}-${o.stat}`}>
                  <td>{o.name}</td>
                  <td>{o.stat}</td>
                  <td className={o.value > o.typical ? 'bal-high' : 'bal-low'}>{formatNumber(o.value)}</td>
                  <td>
                    {formatNumber(o.typical)} <span className="muted">({o.group.split(':')[1]})</span>
                  </td>
                  <td>
                    <button className="icon-btn" title="Open" aria-label="Open" onClick={() => openEntity(o.type, o.id)}>
                      <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="ld-inline">
          Difficulty curve
          {enemyStats.length > 0 && (
            <select className="input" value={chosen} onChange={(e) => setStat(e.target.value)}>
              {enemyStats.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </h3>
        {c.levels.length < 2 ? (
          <p className="muted">Give enemies a level and numbers (under Numbers in the Enemy List) to see how {chosen || 'their stats'} grow.</p>
        ) : (
          <>
            <LineChart xs={c.levels} series={[{ name: `Average ${chosen}`, values: c.avg }]} xLabel="Enemy level" />
            {c.spikes.length === 0 ? (
              <p>The curve grows smoothly.</p>
            ) : (
              c.spikes.map((s) => (
                <p key={s.level} className={s.change > 0 ? 'bal-high' : 'bal-low'}>
                  Level {s.level}: {chosen} {s.change > 0 ? 'jumps up' : 'drops'} by {Math.round(Math.abs(s.change) * 100)}% compared with the level before.
                </p>
              ))
            )}
          </>
        )}
      </section>

      <section>
        <h3>Gaps</h3>
        <p>
          {items.length} items and {enemies.length} enemies. {noStats.length ? `${noStats.length} have no numbers yet: ${noStats.slice(0, 8).map((e) => e.name || 'Untitled').join(', ')}${noStats.length > 8 ? '…' : ''}.` : 'All have numbers.'}
        </p>
        <p>{noDrops.length ? `${noDrops.length} enemies drop nothing: ${noDrops.slice(0, 8).map((e) => e.name || 'Untitled').join(', ')}${noDrops.length > 8 ? '…' : ''}.` : 'Every enemy drops something.'}</p>
      </section>
    </div>
  )
}
