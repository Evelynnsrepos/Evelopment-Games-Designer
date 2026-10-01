import { FileText } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'writer',
  name: 'Writer',
  description: 'Rich text documents for design docs and scripts.',
  icon: FileText,
  specSection: '8.6',
  multiDocument: true,
  newDocumentTitle: 'Untitled document',
  View: lazy(() => import('./View')),
}
