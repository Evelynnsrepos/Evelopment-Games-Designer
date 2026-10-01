import { isTauri } from '../fs'
import { flushAll } from './autosave'
import { useProjectStore } from './projectStore'

/**
 * Save everything before the app window closes (spec 3.5, 11).
 *
 * Desktop: the Tauri close request is held until the open project is closed
 * (all pending saves written, launcher stats refreshed) and `beforeClose`
 * (e.g. waiting for backups) has finished; then the window closes.
 * Browser dev build: `beforeunload` cannot wait, so pending saves are
 * started immediately instead.
 */
export function installCloseGuard(beforeClose?: () => Promise<void>): () => void {
  const onUnload = () => void flushAll()
  window.addEventListener('beforeunload', onUnload)
  let unlisten: (() => void) | null = null
  let disposed = false

  if (isTauri()) {
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const stop = await getCurrentWindow().onCloseRequested(async () => {
        try {
          await flushAll()
          await useProjectStore.getState().close()
          await beforeClose?.()
        } catch (error) {
          // Never trap the user in a window that cannot close.
          console.error('Saving before close failed', error)
        }
      })
      if (disposed) stop()
      else unlisten = stop
    })
  }

  return () => {
    disposed = true
    window.removeEventListener('beforeunload', onUnload)
    unlisten?.()
  }
}
