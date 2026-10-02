import { Palette } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'design-language',
  name: 'Design Language',
  description: 'The look of your game: images, sketches with layers and brushes, a palette and style rules.',
  icon: Palette,
  specSection: 'v0.5',
  multiDocument: true,
  newDocumentTitle: 'Untitled design language',
  View: lazy(() => import('./View')),
}
