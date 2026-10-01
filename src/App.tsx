import { useEffect } from 'react'
import { flushAll, useAppStore } from '@/core/state'
import { EditorScreen } from '@/shell/editor/EditorScreen'
import { Launcher } from '@/shell/launcher/Launcher'
import { NewProjectWizard } from '@/shell/launcher/NewProjectWizard'
import { DialogHost } from '@/shared/ui'

export default function App() {
  const screen = useAppStore((s) => s.screen)

  useEffect(() => {
    // Spec 3.5: save immediately when the app closes.
    const onUnload = () => void flushAll()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  return (
    <>
      {screen === 'launcher' && <Launcher />}
      {screen === 'new-project' && <NewProjectWizard />}
      {screen === 'editor' && <EditorScreen />}
      <DialogHost />
    </>
  )
}
