import { useState } from 'react'
import type { Id, Town } from '@/core/model'

export const POPUP_UI = {
  title: 'New city',
  name: 'City name',
  create: 'Create',
  existing: 'Or place a town from the Town List',
  pick: 'Choose a town…',
  cancel: 'Cancel',
  hint: 'The city is added to the Town List.',
}

/** Shown where the user clicked with the City tool: name a new town or place an existing one (MP-5). */
export function NewCityPopup(p: {
  left: number
  top: number
  /** Towns not yet on this map. */
  unplaced: Town[]
  onCreate(name: string): void
  onPlace(townId: Id): void
  onCancel(): void
}) {
  const [name, setName] = useState('')
  const create = () => {
    if (name.trim()) p.onCreate(name.trim())
  }
  return (
    <div
      className="map-popup"
      style={{ left: p.left, top: p.top }}
      role="dialog"
      aria-label={POPUP_UI.title}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          p.onCancel()
        }
      }}
    >
      <form
        className="map-popup-row"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <input className="input" autoFocus placeholder={POPUP_UI.name} aria-label={POPUP_UI.name} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          {POPUP_UI.create}
        </button>
      </form>
      {p.unplaced.length > 0 && (
        <select className="input" value="" aria-label={POPUP_UI.existing} onChange={(e) => e.target.value && p.onPlace(e.target.value)}>
          <option value="">{POPUP_UI.existing}</option>
          {p.unplaced.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <div className="map-popup-foot">
        <small>{POPUP_UI.hint}</small>
        <button className="btn btn-ghost" onClick={p.onCancel}>
          {POPUP_UI.cancel}
        </button>
      </div>
    </div>
  )
}
