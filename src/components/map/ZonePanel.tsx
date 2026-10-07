import { ExternalLink, Trash2, X } from 'lucide-react'
import type { Id } from '@/core/model'
import { jumpTo, LinkPicker, targetKey as keyOf, useTargetName } from '@/shared/entityList'
import { ProofTextarea } from '@/shared/spell'
import { ZONE_COLORS, type ZoneNode } from './model'

export interface ZoneFaction {
  id: Id
  name: string
  color: string
}

const UI = {
  title: 'Zone',
  name: 'Name',
  namePlaceholder: 'Shown on the map (the faction name if empty)',
  faction: 'Faction',
  noFaction: 'No faction',
  openFactions: 'Open in Factions',
  color: 'Color',
  colorFromFaction: 'The color comes from the faction.',
  links: 'Linked to',
  noLinks: 'Link characters, towns, documents and more to this zone.',
  addLink: 'Link to…',
  notes: 'Notes',
  remove: 'Remove zone',
  close: 'Close',
}

/** The selected zone: name, faction, color, links you can jump along, notes (v0.12). */
export function ZonePanel(p: { zone: ZoneNode; factions: ZoneFaction[]; onChange(patch: Partial<ZoneNode>): void; onRemove(): void; onClose(): void }) {
  const { zone } = p
  const nameOf = useTargetName()
  const faction = p.factions.find((f) => f.id === zone.factionId)

  return (
    <aside className="map-panel" aria-label={UI.title} onPointerDown={(e) => e.stopPropagation()}>
      <div className="map-panel-head">
        <span>{UI.title}</span>
        <button className="icon-btn" title={UI.close} aria-label={UI.close} onClick={p.onClose}>
          <X size={15} />
        </button>
      </div>

      <label className="map-field">
        <span>{UI.name}</span>
        <input className="input" value={zone.name} placeholder={UI.namePlaceholder} onChange={(e) => p.onChange({ name: e.target.value })} />
      </label>

      <div className="map-field">
        <span>{UI.faction}</span>
        <div className="map-row">
          <select className="input" value={zone.factionId ?? ''} onChange={(e) => p.onChange({ factionId: e.target.value || null })} style={{ flex: 1 }}>
            <option value="">{UI.noFaction}</option>
            {p.factions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button className="icon-btn" title={UI.openFactions} aria-label={UI.openFactions} onClick={() => jumpTo({ kind: 'document', type: 'factions', documentId: null })}>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="map-field">
        <span>{UI.color}</span>
        {faction ? (
          <span className="muted">{UI.colorFromFaction}</span>
        ) : (
          <div className="map-swatches" role="radiogroup" aria-label={UI.color}>
            {ZONE_COLORS.map((c) => (
              <button key={c} role="radio" aria-label={c} aria-checked={zone.color === c} className="map-swatch" style={{ background: c }} onClick={() => p.onChange({ color: c })} />
            ))}
          </div>
        )}
      </div>

      <div className="map-field">
        <span>{UI.links}</span>
        {zone.links.length === 0 && <span className="muted">{UI.noLinks}</span>}
        {zone.links.map((t) => (
          <div className="map-row map-zone-link" key={keyOf(t)}>
            <button className="elist-link" title={`Go to ${nameOf(t)}`} onClick={() => jumpTo(t)}>
              {nameOf(t)}
            </button>
            <button className="icon-btn" title="Remove link" aria-label={`Remove link to ${nameOf(t)}`} onClick={() => p.onChange({ links: zone.links.filter((x) => keyOf(x) !== keyOf(t)) })}>
              <X size={13} />
            </button>
          </div>
        ))}
        <LinkPicker exclude={zone.links} onPick={(t) => p.onChange({ links: [...zone.links, t] })} label={UI.addLink} />
      </div>

      <label className="map-field">
        <span>{UI.notes}</span>
        <ProofTextarea className="input" rows={3} value={zone.notes ?? ''} onChange={(e) => p.onChange({ notes: e.target.value })} />
      </label>

      <div className="map-panel-foot">
        <button className="btn btn-danger" onClick={p.onRemove}>
          <Trash2 size={14} /> {UI.remove}
        </button>
      </div>
    </aside>
  )
}
