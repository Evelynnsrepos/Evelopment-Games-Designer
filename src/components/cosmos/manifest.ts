import { Orbit } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'cosmos',
  name: 'Cosmos Creator',
  description: 'Universes, galaxies, solar systems, planets and moons: mark out where everything is.',
  icon: Orbit,
  specSection: 'v0.3',
  multiDocument: true,
  newDocumentTitle: 'Untitled cosmos',
  View: lazy(() => import('./View')),
}
