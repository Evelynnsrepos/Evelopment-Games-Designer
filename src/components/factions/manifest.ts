import { Flag } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'factions',
  name: 'Factions',
  description: 'Factions with leaders, members and towns, and a matrix of how they feel about each other.',
  icon: Flag,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
