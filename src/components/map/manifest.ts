import { Map } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'map',
  name: 'Map Creator',
  description: 'Cities, streets and terrain stamps.',
  icon: Map,
  specSection: '8.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled map',
  View: lazy(() => import('./View')),
}
