import { AppWindow } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'ui-flow',
  name: 'UI Flow',
  description: 'Menu and screen mockups in phone, tablet or desktop frames with buttons, sliders and lists, joined with arrows.',
  icon: AppWindow,
  specSection: 'v0.10',
  multiDocument: true,
  newDocumentTitle: 'Untitled UI flow',
  View: lazy(() => import('./View')),
}
