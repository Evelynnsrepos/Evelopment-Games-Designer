import { Globe } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'localization',
  name: 'Localization',
  description: 'A string table of every player-facing text in every language, collected from the project, with CSV import and export.',
  icon: Globe,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
