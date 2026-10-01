import { Castle } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'town-list',
  name: 'Town List',
  description: 'Towns, also placed as cities on maps.',
  icon: Castle,
  specSection: '8.12',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
