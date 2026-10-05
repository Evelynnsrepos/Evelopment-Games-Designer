import { useEffect, useRef, useState } from 'react'
import { actionLabel, QUICK_SLOTS, type ActionId, type QuickMenuProfile } from './actions'

const UI = {
  close: 'Close',
  empty: 'Empty',
  settings: 'Change the slots in Pen and keys settings',
}

const RADIUS = 78

/**
 * QuickMenu (Sketch Pro): six actions in a ring around the pointer. Click a
 * slot, or hold the menu key, point at a slot and let go.
 */
export function QuickMenu({ at, profile, holdKey, onPick, onClose }: { at: { x: number; y: number }; profile: QuickMenuProfile; holdKey?: string; onPick(id: ActionId): void; onClose(): void }) {
  const [hover, setHover] = useState<number | null>(null)
  const hoverRef = useRef<number | null>(null)
  const opened = useRef(0)
  useEffect(() => {
    hoverRef.current = hover
  })
  useEffect(() => {
    opened.current = performance.now()
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.type === 'keydown' && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
      // Hold-and-release: letting go of the menu key over a slot runs it; a quick tap leaves the menu open.
      if (e.type === 'keyup' && holdKey && e.key.toLowerCase() === holdKey) {
        const slot = hoverRef.current
        const id = slot != null ? profile.slots[slot] : null
        if (id) {
          onClose()
          onPick(id)
        } else if (performance.now() - opened.current > 400) onClose()
      }
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('keyup', key, true)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('keyup', key, true)
    }
  }, [holdKey, profile, onPick, onClose])

  return (
    <div className="quick-menu-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()} onContextMenu={(e) => e.preventDefault()}>
      <div className="quick-menu" style={{ left: at.x, top: at.y }} title={UI.settings}>
        {Array.from({ length: QUICK_SLOTS }, (_, i) => {
          const id = profile.slots[i]
          const a = -Math.PI / 2 + (i * Math.PI * 2) / QUICK_SLOTS
          return (
            <button
              key={i}
              className={`quick-slot${hover === i ? ' is-hover' : ''}${id ? '' : ' is-empty'}`}
              style={{ left: Math.cos(a) * RADIUS, top: Math.sin(a) * RADIUS }}
              disabled={!id}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              onClick={() => {
                if (!id) return
                onClose()
                onPick(id)
              }}
            >
              {id ? actionLabel(id) : UI.empty}
            </button>
          )
        })}
        <button className="quick-center" onClick={onClose} aria-label={UI.close}>
          {profile.name}
        </button>
      </div>
    </div>
  )
}
