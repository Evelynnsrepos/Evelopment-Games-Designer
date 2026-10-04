import { Grid3x3 } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'level-layout',
  name: 'Level Layout',
  description: 'Paint levels and dungeons on a tile grid: rooms, doors, enemies, loot, spawns and numbered notes.',
  icon: Grid3x3,
  specSection: 'v0.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled level',
  View: lazy(() => import('./View')),
}
