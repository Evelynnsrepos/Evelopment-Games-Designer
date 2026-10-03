import { ClipboardCheck } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'reviews',
  name: 'Reviews',
  description: 'Status from Idea to Final and comment threads on everything in the project.',
  icon: ClipboardCheck,
  specSection: 'v0.7',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
