import type { ComponentManifest, PanelProps } from '@/core/registry'
import './ui.css'

/** Shown by component modules that have not been built yet. */
export function ComingSoon({ manifest }: PanelProps & { manifest: ComponentManifest }) {
  const Icon = manifest.icon
  return (
    <div className="coming-soon">
      <Icon size={40} strokeWidth={1.4} />
      <h2>{manifest.name}</h2>
      <div>{manifest.description}</div>
      <div style={{ fontSize: 12 }}>Not built yet. See spec section {manifest.specSection}.</div>
    </div>
  )
}
