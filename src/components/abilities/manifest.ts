import { Sparkles } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'abilities',
  name: 'Abilities & Spells',
  description: 'Abilities and spells with costs, cooldowns and numbers from Damage Calculator formulas.',
  icon: Sparkles,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
