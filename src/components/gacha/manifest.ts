import { Dices } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'gacha',
  name: 'Gacha & Loot Simulator',
  description: 'Banner rates, pity and 50/50s simulated, plus chest and drop table chances.',
  icon: Dices,
  specSection: 'v0.7',
  multiDocument: true,
  newDocumentTitle: 'Untitled banner',
  View: lazy(() => import('./View')),
}
