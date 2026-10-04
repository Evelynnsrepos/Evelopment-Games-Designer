import { Scale } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'balance',
  name: 'Balance Dashboard',
  description: 'Item and enemy numbers that stick out, the enemy difficulty curve and gaps in your data.',
  icon: Scale,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
