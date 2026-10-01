import { Calculator } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'resource-calculator',
  name: 'Resource Calculator',
  description: 'Resources and play time needed for a goal.',
  icon: Calculator,
  specSection: '8.9',
  multiDocument: true,
  newDocumentTitle: 'Untitled resource plan',
  View: lazy(() => import('./View')),
}
