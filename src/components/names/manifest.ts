import { Languages } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'names',
  name: 'Names & Languages',
  description: 'Generate names from a language’s sounds and build a small made-up language with a dictionary and translator.',
  icon: Languages,
  specSection: 'v0.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled language',
  View: lazy(() => import('./View')),
}
