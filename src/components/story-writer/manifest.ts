import { Waypoints } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'story-writer',
  name: 'Story Branch Writer',
  description: 'Mind-map style branching story nodes.',
  icon: Waypoints,
  specSection: '8.5',
  multiDocument: true,
  newDocumentTitle: 'Untitled story',
  View: lazy(() => import('./View')),
}
