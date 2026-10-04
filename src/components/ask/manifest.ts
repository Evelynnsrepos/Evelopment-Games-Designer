import { MessageCircleQuestion } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'ask',
  name: 'Ask Your Project',
  description: 'Look things up in your own notes and find contradictions, with the AI helper running only on your computer. It never writes for you.',
  icon: MessageCircleQuestion,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
