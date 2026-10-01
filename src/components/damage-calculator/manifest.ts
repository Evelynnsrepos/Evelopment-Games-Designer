import { Swords } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'damage-calculator',
  name: 'Damage Calculator',
  description: 'Damage formulas grouped by game type.',
  icon: Swords,
  specSection: '8.3',
  multiDocument: true,
  newDocumentTitle: 'Untitled damage preset',
  View: lazy(() => import('./View')),
}
