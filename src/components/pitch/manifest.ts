import { Presentation } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'pitch',
  name: 'Pitch Deck',
  description: 'Slides built from your vision, pillars, characters and items, presented full screen.',
  icon: Presentation,
  specSection: 'v0.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled pitch',
  View: lazy(() => import('./View')),
}
