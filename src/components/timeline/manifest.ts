import { GitBranch } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'timeline',
  name: 'Timeline',
  description: 'Branched timelines with events and alternative branches.',
  icon: GitBranch,
  specSection: '8.1',
  multiDocument: true,
  newDocumentTitle: 'Untitled timeline',
  View: lazy(() => import('./View')),
}
