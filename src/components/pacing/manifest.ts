import { Activity } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'pacing',
  name: 'Pacing Graph',
  description: 'The player journey as beats on a graph of intensity, story stakes or your own curves, with pacing advice.',
  icon: Activity,
  specSection: 'v0.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled journey',
  View: lazy(() => import('./View')),
}
