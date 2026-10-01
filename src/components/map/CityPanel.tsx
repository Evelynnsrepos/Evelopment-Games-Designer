import { ExternalLink, Trash2, X } from 'lucide-react'
import type { Category, CategoryValue, Id, Town } from '@/core/model'
import { CategoryFields } from '@/shared/categories'
import { CITY_SIZES, MARKER_COLORS, type CityNode, type CitySize } from './model'

export const PANEL_UI = {
  title: 'City',
  name: 'Name',
  size: 'Size',
  marker: 'Marker color',
  description: 'Description',
  associations: 'Associations',
  openTownList: 'Open in Town List',
  remove: 'Remove from map',
  removeHint: 'The town stays in the Town List.',
  close: 'Close',
  missing: 'This town was deleted from the Town List.',
  relink: 'Link to another town',
  pick: 'Choose a town…',
  recreate: 'Create it again',
}

export interface CityPanelProps {
  city: CityNode
  town: Town | undefined
  towns: Town[]
  categories: Category[]
  onCityChange(patch: Partial<CityNode>): void
  onTownChange(patch: Partial<Town>): void
  onCategoriesChange(next: Category[]): void
  onRecreate(): void
  onOpenTownList(): void
  onRemove(): void
  onClose(): void
}

/** Details of the selected city: the linked town's name and associations (MP-4) plus marker style. */
export function CityPanel(p: CityPanelProps) {
  const { city, town } = p
  return (
    <aside className="map-panel" aria-label={PANEL_UI.title} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="map-panel-head">
        <span>{PANEL_UI.title}</span>
        <button className="icon-btn" title={PANEL_UI.close} aria-label={PANEL_UI.close} onClick={p.onClose}>
          <X size={15} />
        </button>
      </div>

      {town ? (
        <>
          <label className="map-field">
            <span>{PANEL_UI.name}</span>
            <input className="input" value={town.name} onChange={(e) => p.onTownChange({ name: e.target.value })} />
          </label>

          <div className="map-field">
            <span>{PANEL_UI.size}</span>
            <div className="map-segmented" role="radiogroup" aria-label={PANEL_UI.size}>
              {CITY_SIZES.map((s) => (
                <button key={s.id} role="radio" aria-checked={city.mode === s.id} className={city.mode === s.id ? 'is-active' : ''} onClick={() => p.onCityChange({ mode: s.id as CitySize })}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="map-field">
            <span>{PANEL_UI.marker}</span>
            <div className="map-swatches" role="radiogroup" aria-label={PANEL_UI.marker}>
              {MARKER_COLORS.map((c) => (
                <button key={c} role="radio" aria-label={c} aria-checked={city.markerColor === c} className="map-swatch" style={{ background: c }} onClick={() => p.onCityChange({ markerColor: c })} />
              ))}
            </div>
          </div>

          <div className="map-field">
            <span>{PANEL_UI.associations}</span>
            <CategoryFields
              type="town"
              entity={town}
              allIds={p.towns.map((t) => t.id)}
              categories={p.categories}
              onValueChange={(id: Id, value: CategoryValue) => p.onTownChange({ categories: { ...town.categories, [id]: value } })}
              onCategoriesChange={p.onCategoriesChange}
            />
          </div>

          <label className="map-field">
            <span>{PANEL_UI.description}</span>
            <textarea className="input map-textarea" rows={3} value={town.description} onChange={(e) => p.onTownChange({ description: e.target.value })} />
          </label>

          <button className="btn" onClick={p.onOpenTownList}>
            <ExternalLink size={14} /> {PANEL_UI.openTownList}
          </button>
        </>
      ) : (
        <div className="map-missing">
          <p>{PANEL_UI.missing}</p>
          <select className="input" value="" aria-label={PANEL_UI.relink} onChange={(e) => e.target.value && p.onCityChange({ townId: e.target.value })}>
            <option value="">{PANEL_UI.pick}</option>
            {p.towns.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={p.onRecreate}>
            {PANEL_UI.recreate}
          </button>
        </div>
      )}

      <div className="map-panel-foot">
        <button className="btn btn-danger" onClick={p.onRemove}>
          <Trash2 size={14} /> {PANEL_UI.remove}
        </button>
        <small>{PANEL_UI.removeHint}</small>
      </div>
    </aside>
  )
}
