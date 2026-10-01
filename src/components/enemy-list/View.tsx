import { Skull } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import type { Enemy } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import { EntityList, formatStat, type ExtraColumn, type ListText } from '@/shared/entityList'
import { enemyActions as actions } from './actions'
import { dropItemName, enemySortStats, levelText, statSummary } from './drops'
import { EnemyDetail } from './EnemyDetail'
import './enemy-list.css'

const TEXT: ListText = {
  one: 'enemy',
  many: 'enemies',
  emptyBody: 'Add your first enemy: slimes, bandits, bosses. Give them stats and a drop table.',
  newName: 'New enemy',
}

/** Most stat columns shown in the table; the rest are on the detail page. */
const MAX_STAT_COLUMNS = 6

/** Enemy List (spec 8.13): enemies with combat stats, growth, drop tables and where they are found. */
export default function View({ active }: PanelProps) {
  const enemies = useProjectStore((s) => s.entities.enemy)
  const items = useProjectStore((s) => s.entities.item)
  const towns = useProjectStore((s) => s.entities.town)

  const searchText = useCallback(
    (e: Enemy) => [
      e.respawnNote ?? '',
      ...Object.keys(e.resistances ?? {}),
      ...(e.dropTable ?? []).map((r) => dropItemName(r, items)),
      ...(e.foundIn ?? []).map((id) => towns.find((t) => t.id === id)?.name ?? ''),
    ],
    [items, towns],
  )

  const columns = useMemo((): ExtraColumn<Enemy>[] => {
    const statNames: string[] = []
    for (const e of enemies) for (const k of Object.keys(e.stats ?? {})) if (!statNames.includes(k)) statNames.push(k)
    return [
      { id: 'level', label: 'Level', render: (e) => levelText(e).slice(3), sortKey: 'stat:Level' },
      ...statNames.slice(0, MAX_STAT_COLUMNS).map(
        (n): ExtraColumn<Enemy> => ({
          id: `stat:${n}`,
          label: n,
          render: (e) => (Object.hasOwn(e.stats ?? {}, n) ? formatStat(e.stats[n]) : <span className="elist-muted">—</span>),
          sortKey: `stat:${n}`,
        }),
      ),
      { id: 'drops', label: 'Drops', render: (e) => (e.dropTable ?? []).length || <span className="elist-muted">—</span> },
    ]
  }, [enemies])

  return (
    <EntityList
      type="enemy"
      active={active}
      actions={actions}
      text={TEXT}
      icon={Skull}
      stats={enemySortStats}
      searchText={searchText}
      columns={columns}
      cardMeta={(e) => [levelText(e), statSummary(e.stats ?? {}, 2)].filter(Boolean).join(' · ')}
      renderDetail={(e, ctx) => <EnemyDetail enemy={e} ctx={ctx} text={TEXT} />}
    />
  )
}
