import { BookMarked } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'principles',
  name: 'Writing Principles',
  description: 'Rules for good stories and game narrative, plus story structures like the Hero’s Journey. Add your own.',
  icon: BookMarked,
  specSection: 'v0.9',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
