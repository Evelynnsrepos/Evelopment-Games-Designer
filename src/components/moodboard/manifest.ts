import { Images } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'moodboard',
  name: 'Moodboard',
  description: 'Images, cutouts, shapes and text with layers.',
  icon: Images,
  specSection: '8.7',
  multiDocument: true,
  newDocumentTitle: 'Untitled moodboard',
  View: lazy(() => import('./View')),
}
