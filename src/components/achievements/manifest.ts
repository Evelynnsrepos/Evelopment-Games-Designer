import { Trophy } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'achievements',
  name: 'Achievements',
  description: 'Achievements with how they unlock, points, rewards, hidden ones and how rare they should be.',
  icon: Trophy,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
