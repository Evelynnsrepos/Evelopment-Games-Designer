import { RefreshCw } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'gameplay-loop',
  name: 'Gameplay Loop',
  description: 'Build the loop players repeat as a circular timeline, flesh out each step and branch notes off it.',
  icon: RefreshCw,
  specSection: 'v0.9',
  multiDocument: true,
  newDocumentTitle: 'Core loop',
  View: lazy(() => import('./View')),
}
