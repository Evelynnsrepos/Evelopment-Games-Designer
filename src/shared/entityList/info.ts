import type { Category, Entity, EntityType, Id } from '@/core/model'
import { categoriesFor, ENTITY_LABELS, entityLook, fieldLines, formatValue } from '@/shared/categories'

export interface InfoRow {
  label: string
  value: string
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The label/value rows of an entity's info box (wiki WK-3, Design Book): categories, links, level, drops, rarity fields. */
export function entityInfoRows(entity: Entity, entities: Record<EntityType, Entity[]>, categories: Category[]): { rows: InfoRow[]; stats: [string, number][] } {
  const nameOf = (type: EntityType, id: Id) => entities[type].find((e) => e.id === id)?.name || 'missing'
  const rows: InfoRow[] = []
  for (const c of categoriesFor(categories, entity.type, entity.id)) {
    const value = formatValue(c, entity.categories[c.id])
    if (value) rows.push({ label: c.name, value })
  }
  if (entity.type === 'character' || entity.type === 'town') {
    for (const link of entity.links) rows.push({ label: link.label || cap(ENTITY_LABELS[link.targetType].one), value: nameOf(link.targetType, link.targetId) })
  }
  if (entity.type === 'enemy') {
    rows.push({ label: 'Level', value: entity.levelMin === entity.levelMax ? `${entity.levelMin}` : `${entity.levelMin}–${entity.levelMax}` })
    if (entity.dropTable.length) rows.push({ label: 'Drops', value: entity.dropTable.map((d) => `${nameOf('item', d.itemId)} (${d.chancePercent}%)`).join(', ') })
    if (entity.foundIn.length) rows.push({ label: 'Found in', value: entity.foundIn.map((id) => nameOf('town', id)).join(', ') })
  }
  // The rarity's own fields (drop rate, sell price…) show as rows too.
  const look = entityLook(categories, entity.type, entity)
  if (look) rows.push(...fieldLines(look.category, look.style))
  const stats = entity.type === 'item' || entity.type === 'enemy' ? Object.entries(entity.stats) : []
  return { rows, stats }
}
