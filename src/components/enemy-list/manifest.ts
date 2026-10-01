import { Skull } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'enemy-list',
  name: 'Enemy List',
  description: 'Enemies, combat stats and drop tables.',
  icon: Skull,
  specSection: '8.13',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
