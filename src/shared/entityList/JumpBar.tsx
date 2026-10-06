import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ENTITY_TYPES, type Entity, type EntityType, type Id } from '@/core/model'
import { collectIds, findReferences, type Reference } from '@/core/references'
import { getManifest } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import { describeReference } from '@/shared/entityDelete'
import { TYPE_LABEL } from './links'
import { jumpTo, type JumpTarget } from './navigation'

interface Chip {
  key: string
  label: string
  kind: string
  target: JumpTarget
}

/** "dropTable.itemId" -> "drop table" */
const fieldLabel = (field: string) =>
  field
    .split('.')[0]
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()

/** "Jump to": everything this entity points at (its town, the items it drops, its links), one click each. */
export function JumpBar({ entity }: { entity: Entity }) {
  const entities = useProjectStore((s) => s.entities)
  const documents = useProjectStore((s) => s.meta?.documents)
  const chips = useMemo(() => {
    const byId = new Map<Id, { type: EntityType; e: Entity }>()
    for (const type of ENTITY_TYPES) for (const e of entities[type] as Entity[]) byId.set(e.id.toLowerCase(), { type, e })
    const docs = new Map((documents ?? []).map((d) => [d.id.toLowerCase(), d]))
    const out: Chip[] = []
    for (const [id, fields] of collectIds(entity)) {
      if (id === entity.id.toLowerCase()) continue
      const why = [...new Set([...fields].filter(Boolean).map(fieldLabel))].join(', ')
      const hit = byId.get(id)
      const doc = docs.get(id)
      if (hit) out.push({ key: id, label: hit.e.name || `Untitled ${TYPE_LABEL[hit.type].toLowerCase()}`, kind: why || TYPE_LABEL[hit.type], target: { kind: 'entity', type: hit.type, id: hit.e.id } })
      else if (doc) out.push({ key: id, label: doc.title, kind: why || (getManifest(doc.type)?.name ?? doc.type), target: { kind: 'document', type: doc.type, documentId: doc.id } })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  }, [entity, entities, documents])

  if (chips.length === 0) return null
  return (
    <nav className="jump-bar" aria-label="Jump to">
      <span className="elist-muted">Jump to</span>
      {chips.map((c) => (
        <button key={c.key} className="jump-chip" title={`${c.label} (${c.kind})`} onClick={() => jumpTo(c.target)}>
          {c.label}
        </button>
      ))}
    </nav>
  )
}

const sourceTarget = (r: Reference): JumpTarget =>
  r.source.kind === 'entity'
    ? { kind: 'entity', type: r.source.entityType, id: r.source.entityId }
    : { kind: 'document', type: r.source.componentType, documentId: r.source.documentId }

/** "Used in": every place in the project that mentions this entity, from the same index the delete check uses. */
export function UsedIn({ id }: { id: Id }) {
  const [tick, setTick] = useState(0)
  const key = `${id}:${tick}`
  const [found, setFound] = useState<{ key: string; refs: Reference[] } | null>(null)
  const refs = found?.key === key ? found.refs : null
  useEffect(() => {
    let live = true
    // ponytail: scans the whole saved project per page open; cache the index if big projects feel slow.
    void findReferences(id).then((r) => live && setFound({ key, refs: r }))
    return () => {
      live = false
    }
  }, [id, key])

  return (
    <div className="elist-rows">
      {refs === null ? (
        <div className="elist-muted">Looking…</div>
      ) : refs.length === 0 ? (
        <div className="elist-muted">Not used anywhere else yet.</div>
      ) : (
        <ul className="elist-refs">
          {refs.map((r, i) => (
            <li key={i}>
              <button className="elist-link" onClick={() => jumpTo(sourceTarget(r))}>
                {describeReference(r)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost elist-add-row" onClick={() => setTick((t) => t + 1)}>
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  )
}
