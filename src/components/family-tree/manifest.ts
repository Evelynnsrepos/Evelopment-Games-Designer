import { Users } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'family-tree',
  name: 'Family Tree',
  description: 'Characters from the Character List as a family tree with parents, children and partners.',
  icon: Users,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
