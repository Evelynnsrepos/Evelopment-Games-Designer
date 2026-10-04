import { CalendarDays } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentManifest } from '@/core/registry'

export const manifest: ComponentManifest = {
  type: 'calendar',
  name: 'Calendar & Eras',
  description: 'Your world’s months, weekdays and eras, a month view and a date calculator; timelines show era years.',
  icon: CalendarDays,
  specSection: 'v0.10',
  multiDocument: false,
  View: lazy(() => import('./View')),
}
