import { ExternalLink } from 'lucide-react'
import type { Entity, EntityType, Id } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { AssetImage } from '@/shared/AssetImage'
import { openEntity } from '@/shared/entityList'
import { categoriesFor, ENTITY_LABELS, formatValue } from '@/shared/categories'

const UI = {
  deleted: (type: string) => `The ${type.toLowerCase()} that this article was pulled from has been deleted.`,
  openList: (list: string) => `Open in ${list}`,
  stats: 'Stats',
  level: 'Level',
  drops: 'Drops',
  foundIn: 'Found in',
  missing: 'missing',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const LIST_NAME: Record<EntityType, string> = { item: 'Item List', character: 'Character List', town: 'Town List', enemy: 'Enemy List' }

interface Row {
  label: string
  value: string
}

/** Info box of an article pulled from an entity (WK-3). Reads the entity live, so edits in its list show up here. */
export function InfoBox({ kind, entityId }: { kind: EntityType; entityId: Id }) {
  const entities = useProjectStore((s) => s.entities)
  const categories = useProjectStore((s) => s.categories)
  const entity = (entities[kind] as Entity[]).find((e) => e.id === entityId)
  const typeName = cap(ENTITY_LABELS[kind].one)

  if (!entity) return <aside className="wiki-infobox wiki-infobox-missing">{UI.deleted(typeName)}</aside>

  const nameOf = (type: EntityType, id: Id) => (entities[type] as Entity[]).find((e) => e.id === id)?.name || UI.missing
  const rows: Row[] = []
  for (const c of categoriesFor(categories, kind, entity.id)) {
    const value = formatValue(c, entity.categories[c.id])
    if (value) rows.push({ label: c.name, value })
  }
  if (entity.type === 'character' || entity.type === 'town') {
    for (const link of entity.links) rows.push({ label: link.label || cap(ENTITY_LABELS[link.targetType].one), value: nameOf(link.targetType, link.targetId) })
  }
  if (entity.type === 'enemy') {
    const lv = entity.levelMin === entity.levelMax ? `${entity.levelMin}` : `${entity.levelMin}–${entity.levelMax}`
    rows.push({ label: UI.level, value: lv })
    if (entity.dropTable.length)
      rows.push({ label: UI.drops, value: entity.dropTable.map((d) => `${nameOf('item', d.itemId)} (${d.chancePercent}%)`).join(', ') })
    if (entity.foundIn.length) rows.push({ label: UI.foundIn, value: entity.foundIn.map((id) => nameOf('town', id)).join(', ') })
  }
  const stats = entity.type === 'item' || entity.type === 'enemy' ? Object.entries(entity.stats) : []

  return (
    <aside className="wiki-infobox" aria-label={`${typeName} info`}>
      <div className="wiki-infobox-head">
        <strong>{entity.name || 'Untitled'}</strong>
        <span className="wiki-infobox-type">{typeName}</span>
      </div>
      <div className="wiki-infobox-image">
        <AssetImage path={entity.image} alt={entity.name} size={180} />
      </div>
      {entity.description.trim() && <p className="wiki-infobox-desc">{entity.description}</p>}
      {rows.length > 0 && (
        <dl className="wiki-infobox-rows">
          {rows.map((r, i) => (
            <div key={i}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {stats.length > 0 && (
        <>
          <div className="wiki-infobox-sub">{UI.stats}</div>
          <dl className="wiki-infobox-rows">
            {stats.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <button className="btn btn-ghost wiki-infobox-open" onClick={() => openEntity(kind, entityId)}>
        <ExternalLink size={13} /> {UI.openList(LIST_NAME[kind])}
      </button>
    </aside>
  )
}
