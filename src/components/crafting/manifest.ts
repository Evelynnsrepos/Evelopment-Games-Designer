import { Hammer } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'crafting',
  name: 'Crafting & Recipes',
  description: 'Recipes with ingredients, stations and times, a crafting tree and the raw materials anything needs.',
  icon: Hammer,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
