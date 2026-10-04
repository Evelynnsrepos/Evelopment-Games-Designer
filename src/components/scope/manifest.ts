import { ListChecks } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'scope',
  name: 'Scope Planner',
  description: 'Every feature sorted into must, should, could, won’t and cut, with effort against the days you have.',
  icon: ListChecks,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
