import { Swords } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'combat',
  name: 'Combat Simulator',
  description: 'Two teams fight many times with a damage formula: win rates, fight length, damage and an example fight.',
  icon: Swords,
  specSection: 'v0.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled fight',
  View: lazy(() => import('./View')),
}
