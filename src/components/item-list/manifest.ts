import { Package } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'item-list',
  name: 'Item List',
  description: 'Every item in the game, with shared categories.',
  icon: Package,
  specSection: '8.4',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
