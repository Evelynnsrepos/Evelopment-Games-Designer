import { Modal } from '../ui'
import { ACTIONS, formatCombo, keysFor } from './actions'
import { useInputSettings } from './inputSettings'

const UI = {
  title: 'Keyboard shortcuts',
  hint: 'Change any of them in Pen and keys. Hold Space to pan, Alt to pick a colour, Shift for straight lines and perfect shapes.',
  none: 'no key',
  close: 'Close',
}

const GROUPS: [string, (id: string) => boolean][] = [
  ['Tools', (id) => id.startsWith('tool.') || id === 'swapEraser'],
  ['Brush and colour', (id) => ['sizeUp', 'sizeDown', 'fill', 'clear'].includes(id)],
  ['Edit', (id) => ['undo', 'redo', 'deselect', 'newLayer', 'flipLayerX', 'flipLayerY', 'adjustments', 'liquify', 'clone'].includes(id)],
  ['View', (id) => ['fit', 'rotateLeft', 'rotateRight', 'flipView', 'quickMenu', 'guides', 'assist', 'shortcuts'].includes(id)],
  ['Files and canvas', () => true],
]

/** A list of every Sketch shortcut with its current keys (opened with the keyboard button or Shift+?). */
export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const custom = useInputSettings((s) => s.shortcuts)
  const seen = new Set<string>()
  return (
    <Modal onClose={onClose}>
      <h3>{UI.title}</h3>
      <p className="muted">{UI.hint}</p>
      <div className="shortcut-sheet">
        {GROUPS.map(([name, test]) => {
          const items = ACTIONS.filter((a) => !seen.has(a.id) && test(a.id))
          items.forEach((a) => seen.add(a.id))
          if (!items.length) return null
          return (
            <section key={name}>
              <h4>{name}</h4>
              {items.map((a) => {
                const keys = keysFor(a.id, custom)
                return (
                  <div key={a.id} className="shortcut-row">
                    <span>{a.label}</span>
                    <span className={keys.length ? 'shortcut-keys' : 'muted'}>{keys.length ? keys.map((k) => <kbd key={k}>{formatCombo(k)}</kbd>) : UI.none}</span>
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>
          {UI.close}
        </button>
      </div>
    </Modal>
  )
}
