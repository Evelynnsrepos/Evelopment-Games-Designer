import { PackageCheck } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'asset-pool',
  name: 'Asset Pool',
  description: 'Track every asset the game still needs: art, models, sounds and more.',
  icon: PackageCheck,
  specSection: 'v0.5',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
