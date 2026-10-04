import { Coins } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'economy',
  name: 'Economy Simulator',
  description: 'Currency sources and sinks simulated over hours of play: balances, purchases and inflation warnings.',
  icon: Coins,
  specSection: 'v0.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled economy',
  View: lazy(() => import('./View')),
}
