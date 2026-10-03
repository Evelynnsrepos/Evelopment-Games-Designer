import { Waves } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'wave-planner',
  name: 'Wave Planner',
  description: 'Plan waves: enemies, time, health growth, drops and the DPS needed.',
  icon: Waves,
  specSection: 'v0.7',
  multiDocument: true,
  newDocumentTitle: 'Untitled wave plan',
  View: lazy(() => import('./View')),
}
