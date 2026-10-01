import { BookOpen } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'wiki',
  name: 'Wiki',
  description: 'Articles, [[links]] and a connection map.',
  icon: BookOpen,
  specSection: '8.2',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
