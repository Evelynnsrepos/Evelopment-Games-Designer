import { Lightbulb } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'brainstorm',
  name: 'Brainstorm Board',
  description: 'Sticky notes, pins and string, areas, audio.',
  icon: Lightbulb,
  specSection: '8.8',
  multiDocument: true,
  newDocumentTitle: 'Untitled board',
  View: lazy(() => import('./View')),
}
