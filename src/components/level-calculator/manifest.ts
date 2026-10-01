import { TrendingUp } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'level-calculator',
  name: 'Level Calculator',
  description: 'XP curves, stat growth and damage per level.',
  icon: TrendingUp,
  specSection: '8.3',
  multiDocument: true,
  newDocumentTitle: 'Untitled level preset',
  View: lazy(() => import('./View')),
}
