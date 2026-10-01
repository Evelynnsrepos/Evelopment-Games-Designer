import type { LucideIcon } from 'lucide-react'
import type { ComponentType as ReactComponentType, LazyExoticComponent } from 'react'
import { COMPONENT_TYPES, type ComponentType, type Id, type Panel } from './model'

/** Props every component view receives from the workspace. */
export interface PanelProps {
  panel: Panel
  /** The document to show, for multi-document components; null otherwise. */
  documentId: Id | null
  /** True when this panel has keyboard focus; only then handle single-key shortcuts. */
  active: boolean
}

/**
 * Each feature module exports `manifest` from `src/components/<type>/manifest.ts`.
 * The shell discovers them automatically, so adding a component never
 * requires editing shared files.
 */
export interface ComponentManifest {
  type: ComponentType
  name: string
  description: string
  icon: LucideIcon
  /** Spec section, shown in placeholders and docs. */
  specSection: string
  /** Several documents per project (SB-4)? List components and the Wiki are single. */
  multiDocument: boolean
  /** Title for a newly created document, e.g. "Untitled timeline". */
  newDocumentTitle?: string
  View: LazyExoticComponent<ReactComponentType<PanelProps>>
}

const modules = import.meta.glob<{ manifest: ComponentManifest }>('../components/*/manifest.ts', { eager: true })

const byType = new Map<ComponentType, ComponentManifest>()
for (const [path, mod] of Object.entries(modules)) {
  const m = mod.manifest
  if (!m) throw new Error(`${path} must export a 'manifest'`)
  if (byType.has(m.type)) throw new Error(`Duplicate component manifest for '${m.type}'`)
  byType.set(m.type, m)
}

export function getManifest(type: ComponentType): ComponentManifest | undefined {
  return byType.get(type)
}

/** Manifests in the order of spec section 6. */
export function allManifests(): ComponentManifest[] {
  return COMPONENT_TYPES.map((t) => byType.get(t)).filter((m): m is ComponentManifest => !!m)
}
