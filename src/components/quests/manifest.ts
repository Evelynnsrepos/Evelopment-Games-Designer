import { ScrollText } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'quests',
  name: 'Quest Designer',
  description: 'Quests with givers, places, objectives, rewards and chains.',
  icon: ScrollText,
  specSection: 'v0.7',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
