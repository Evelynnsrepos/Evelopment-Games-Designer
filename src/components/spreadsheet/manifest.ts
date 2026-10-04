import { Sheet } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'spreadsheet',
  name: 'Spreadsheet',
  description: 'Excel-style sheets: formulas across sheets, fill handle, formatting and Damage Calculator results in cells.',
  icon: Sheet,
  specSection: 'v0.9',
  multiDocument: true,
  newDocumentTitle: 'Untitled spreadsheet',
  View: lazy(() => import('./View')),
}
