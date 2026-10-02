import { usePresence } from '@/core/collab'
import type { Id } from '@/core/model'
import type { Rect, Viewport } from './types'

/**
 * Teammates on the same canvas (shared projects): their pointer with a name
 * label, and an outline in their color around what they have selected.
 */
export function RemoteCursors({ presenceKey, viewport, bounds }: { presenceKey: string; viewport: Viewport; bounds(id: Id): Rect | null }) {
  const remotes = usePresence((s) => s.remotes)
  const here = remotes.filter((r) => r.cursor?.key === presenceKey || r.selection?.key === presenceKey)
  if (here.length === 0) return null
  const s = viewport.scale
  return (
    <div className="canvas-presence" aria-hidden="true">
      {here.map((r) => (
        <div key={r.clientId}>
          {r.selection?.key === presenceKey &&
            r.selection.ids.map((id) => {
              const b = bounds(id)
              if (!b) return null
              return (
                <div
                  key={id}
                  className="canvas-presence-selection"
                  style={{ left: b.x * s + viewport.x - 3, top: b.y * s + viewport.y - 3, width: b.width * s + 6, height: b.height * s + 6, borderColor: r.color }}
                />
              )
            })}
          {r.cursor?.key === presenceKey && (
            <div className="canvas-presence-cursor" style={{ left: r.cursor.x * s + viewport.x, top: r.cursor.y * s + viewport.y }}>
              <svg width="16" height="20" viewBox="0 0 16 20">
                <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill={r.color} stroke="#000" strokeOpacity="0.35" />
              </svg>
              <span style={{ background: r.color }}>{r.name}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
