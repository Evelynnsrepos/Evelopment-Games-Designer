import { ExternalLink } from 'lucide-react'
import type { Entity, EntityType, Id } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { AssetImage } from '@/shared/AssetImage'
import { entityInfoRows, openEntity } from '@/shared/entityList'
import { ENTITY_LABELS, entityLook, frameStyle, ratingText, StyleBadge } from '@/shared/categories'

const UI = {
  deleted: (type: string) => `The ${type.toLowerCase()} that this article was pulled from has been deleted.`,
  openList: (list: string) => `Open in ${list}`,
  stats: 'Stats',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const LIST_NAME: Record<EntityType, string> = { item: 'Item List', character: 'Character List', town: 'Town List', enemy: 'Enemy List' }

/** Info box of an article pulled from an entity (WK-3). Reads the entity live, so edits in its list show up here. */
export function InfoBox({ kind, entityId }: { kind: EntityType; entityId: Id }) {
  const entities = useProjectStore((s) => s.entities)
  const categories = useProjectStore((s) => s.categories)
  const entity = (entities[kind] as Entity[]).find((e) => e.id === entityId)
  const typeName = cap(ENTITY_LABELS[kind].one)

  if (!entity) return <aside className="wiki-infobox wiki-infobox-missing">{UI.deleted(typeName)}</aside>

  const { rows, stats } = entityInfoRows(entity, entities as Record<EntityType, Entity[]>, categories)
  const look = entityLook(categories, kind, entity)

  return (
    <aside className="wiki-infobox" aria-label={`${typeName} info`}>
      <div className="wiki-infobox-head">
        <strong style={look ? { color: look.style.color } : undefined}>{entity.name || 'Untitled'}</strong>
        <span className="wiki-infobox-type">{typeName}</span>
      </div>
      {look && <StyleBadge style={look.style} label={look.value} rating={ratingText(look.category, look.style)} />}
      <div className="wiki-infobox-image" style={frameStyle(look?.style)}>
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
