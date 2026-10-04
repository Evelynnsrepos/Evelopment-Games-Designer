import { ClipboardList } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'playtests',
  name: 'Playtests',
  description: 'Playtest sessions with scores and findings, scores per build and every open problem in one place.',
  icon: ClipboardList,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
