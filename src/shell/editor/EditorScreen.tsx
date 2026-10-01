import { useEffect } from 'react'
import { useAppStore } from '@/core/state'
import { Workspace } from '../workspace/Workspace'
import { openInitialLayout } from './actions'
import { Sidebar } from './Sidebar'
import './editor.css'

/** Project editor: sidebar + tiling workspace (spec 6, 7). */
export function EditorScreen() {
  useEffect(() => {
    openInitialLayout()
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
      <Sidebar />
      <Workspace />
    </div>
  )
}
