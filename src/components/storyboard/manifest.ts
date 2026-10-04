import { Clapperboard } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'storyboard',
  name: 'Storyboard',
  description: 'Cutscene frames with shots, camera moves, dialogue and timing, played back as an animatic.',
  icon: Clapperboard,
  specSection: 'v0.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled cutscene',
  View: lazy(() => import('./View')),
}
