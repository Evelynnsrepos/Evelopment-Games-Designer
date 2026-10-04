import { History } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'history',
  name: 'History',
  description: 'Earlier versions of items, characters, towns and enemies: compare what changed and restore.',
  icon: History,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
