import { useEffect } from 'react'
import { useAppStore } from '@/core/state'
import { maybeStartTour } from '../help/help'
import { Workspace } from '../workspace/Workspace'
import { openInitialLayout } from './actions'
import { CommandPalette } from './CommandPalette'
import { DesignBookHost } from '../designBook/DesignBook'
import { PinThreadHost } from '@/shared/reviews'
import { HistoryRecorder } from '../history/HistoryRecorder'
import { EngineExportHost } from '../engineExport/EngineExport'
import { ProjectWallpaper, useProjectTheme } from './projectTheme'
import { Sidebar } from './Sidebar'
import './editor.css'

/** Project editor: sidebar + tiling workspace (spec 6, 7). */
export function EditorScreen() {
  useProjectTheme()
  useEffect(() => {
    openInitialLayout()
    maybeStartTour('editor')
  }, [])

  useEffect(() => {
    // ED-5/ED-7: Esc toggles Layout Mode unless a tool already handled it.
    // Components that use Esc must call event.preventDefault() in their own handler.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const app = useAppStore.getState()
      app.setLayoutMode(!app.layoutMode)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="editor">
      <ProjectWallpaper />
      <Sidebar />
      <Workspace />
      <CommandPalette />
      <DesignBookHost />
      <PinThreadHost />
      <HistoryRecorder />
      <EngineExportHost />
    </div>
  )
}
