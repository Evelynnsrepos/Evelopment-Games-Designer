import { Brush } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'sketch',
  name: 'Draw',
  description: 'Draw and paint with pressure brushes, layers, selection and mirror.',
  icon: Brush,
  specSection: 'v0.5',
  multiDocument: true,
  newDocumentTitle: 'Untitled drawing',
  View: lazy(() => import('./View')),
}
