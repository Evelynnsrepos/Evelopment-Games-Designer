import { Compass } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'vision',
  name: 'Vision & Pillars',
  description: 'Elevator pitch, vision, player fantasy, selling points, design pillars, references and anti-goals on one page.',
  icon: Compass,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
