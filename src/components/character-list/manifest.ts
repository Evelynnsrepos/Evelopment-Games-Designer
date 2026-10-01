import { Users } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'character-list',
  name: 'Character List',
  description: 'Characters and their associations.',
  icon: Users,
  specSection: '8.11',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
