import { Type } from 'lucide-react'
import { useState } from 'react'
import type { ComponentType } from '@/core/model'
import { getManifest } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import { allLocalFonts, cssFamily, GENERIC_FONTS, systemFonts } from '@/shared/fontList'
import { Modal } from '@/shared/ui'

/** Tools with font menus of their own: the Writer and Wiki (per text) and Draw (per text layer). */
const OWN_FONTS = new Set<ComponentType>(['writer', 'wiki', 'sketch'])

/** v0.12: "Aa" in a tool's header picks the font that tool shows its text in (boards included). */
export function ToolFontButton({ type }: { type: ComponentType }) {
  const [open, setOpen] = useState(false)
  if (OWN_FONTS.has(type)) return null
  return (
    <>
      <button className="panel-font" title="Font for this tool" aria-label="Font for this tool" onClick={() => setOpen(true)}>
        <Type size={12} />
      </button>
      {open && <ToolFontDialog type={type} onClose={() => setOpen(false)} />}
    </>
  )
}

function ToolFontDialog({ type, onClose }: { type: ComponentType; onClose(): void }) {
  const current = useProjectStore((s) => s.meta?.fonts?.[type] ?? '')
  const [local, setLocal] = useState<string[]>([])
  const families = [...new Set([...GENERIC_FONTS, ...systemFonts(), ...local, ...(current ? [current] : [])])]
  const set = (family: string) => {
    const fonts = { ...useProjectStore.getState().meta?.fonts }
    if (family) fonts[type] = family
    else delete fonts[type]
    useProjectStore.getState().updateMeta({ fonts })
  }
  return (
    <Modal onClose={onClose}>
      <h3>Font for {getManifest(type)?.name ?? type}</h3>
      <p className="muted">The text in this tool uses this font, in this project.</p>
      <select className="input" size={10} value={current} onChange={(e) => set(e.target.value)} aria-label="Font" style={{ width: '100%' }}>
        <option value="">App font</option>
        {families.map((f) => (
          <option key={f} value={f} style={{ fontFamily: cssFamily(f) }}>
            {f}
          </option>
        ))}
      </select>
      <p className="tool-font-preview" style={{ fontFamily: current ? cssFamily(current) : undefined }}>
        The ash drake circled the ruined tower twice before landing. 0123456789
      </p>
      <div className="modal-actions">
        {!local.length && (
          <button className="btn btn-ghost" title="The system may ask first" onClick={() => void allLocalFonts().then(setLocal)}>
            All installed fonts…
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={onClose} autoFocus>
          Done
        </button>
      </div>
    </Modal>
  )
}

/** Style for a tool's body with its chosen font. */
export function useToolFontStyle(type: ComponentType): React.CSSProperties | undefined {
  const font = useProjectStore((s) => s.meta?.fonts?.[type])
  if (!font) return undefined
  const family = `${cssFamily(font)}, var(--font)`
  return { fontFamily: family }
}
