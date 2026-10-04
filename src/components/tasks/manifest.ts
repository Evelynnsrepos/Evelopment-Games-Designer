import { SquareKanban } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'tasks',
  name: 'Task Board',
  description: 'A to-do board whose tasks link to the items, characters, articles and documents they are about.',
  icon: SquareKanban,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
