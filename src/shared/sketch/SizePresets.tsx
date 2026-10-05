import type { BrushSettings } from './brushes'

const UI = {
  empty: (n: number) => `Size preset ${n}: click to save the current size here`,
  saved: (n: number, px: number) => `Size preset ${n}: ${px} px. Click to use it, right-click to save the current size instead.`,
}

/** Four saved sizes per brush, under the size slider. */
export function SizePresets({ brush, onChange }: { brush: BrushSettings; onChange: (patch: Partial<BrushSettings>) => void }) {
  const save = (i: number) => onChange({ sizePresets: brush.sizePresets.map((p, j) => (j === i ? Math.round(brush.size * 10) / 10 : p)) })
  return (
    <div className="sketch-size-presets">
      {brush.sizePresets.map((p, i) => (
        <button
          key={i}
          className={`btn${p !== null && p === brush.size ? ' is-active' : ''}${p === null ? ' is-empty' : ''}`}
          title={p === null ? UI.empty(i + 1) : UI.saved(i + 1, p)}
          onClick={() => (p === null ? save(i) : onChange({ size: p }))}
          onContextMenu={(e) => {
            e.preventDefault()
            save(i)
          }}
        >
          {p === null ? '+' : Math.round(p)}
        </button>
      ))}
    </div>
  )
}
