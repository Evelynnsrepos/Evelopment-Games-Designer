import { MessagesSquare } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'dialogue',
  name: 'Dialogue Editor',
  description: 'Conversations with speakers, choices, conditions and flags; export to JSON, Yarn or Ink.',
  icon: MessagesSquare,
  specSection: 'v0.7',
  multiDocument: true,
  newDocumentTitle: 'Untitled conversation',
  View: lazy(() => import('./View')),
}
