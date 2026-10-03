import { Network } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'skill-tree',
  name: 'Skill Tree',
  description: 'Skill and talent trees with ranks, costs and requirements, plus a build planner.',
  icon: Network,
  specSection: 'ideas',
  multiDocument: true,
  newDocumentTitle: 'Untitled skill tree',
  View: lazy(() => import('./View')),
}
