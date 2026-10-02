import { useState } from 'react'
import type { ComponentManifest } from '@/core/registry'
import { Modal } from '@/shared/ui'

const UI = {
  cancel: 'Cancel',
  hide: 'Hide',
  restore: 'Bring back',
  deleteContents: 'Delete contents',
  deleteFresh: 'Delete and start empty',
  armed: 'Press again to delete for good',
  closeTitle: (name: string) => `Close ${name}?`,
  closeText:
    'Hide removes the tool from the sidebar and keeps everything you made in it, so you can bring it back later with Add tool.\nDelete contents removes the tool and everything in it. This cannot be undone.',
  restoreTitle: (name: string) => `${name} has saved contents`,
  restoreText: 'You hid this tool earlier. Bring back what you made in it, or delete it for good and start empty?',
}

/** The really red button: the first press arms it, the second one deletes. */
function DeleteTwiceButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button className={`btn btn-danger tool-delete${armed ? ' armed' : ''}`} onClick={() => (armed ? onDelete() : setArmed(true))}>
      {armed ? UI.armed : label}
    </button>
  )
}

export type CloseChoice = 'hide' | 'delete' | null

/** Right-click → Close tool: hide (keep contents) or delete contents. */
export function CloseToolDialog({ manifest, onDone }: { manifest: ComponentManifest; onDone: (c: CloseChoice) => void }) {
  return (
    <Modal onClose={() => onDone(null)}>
      <h3>{UI.closeTitle(manifest.name)}</h3>
      <div className="tool-dialog-text">{UI.closeText}</div>
      <div className="modal-actions">
        <button className="btn" onClick={() => onDone(null)}>
          {UI.cancel}
        </button>
        <DeleteTwiceButton label={UI.deleteContents} onDelete={() => onDone('delete')} />
        <button className="btn btn-primary" autoFocus onClick={() => onDone('hide')}>
          {UI.hide}
        </button>
      </div>
    </Modal>
  )
}

export type RestoreChoice = 'restore' | 'delete' | null

/** Adding a tool that was hidden with contents: bring them back or delete them. */
export function RestoreToolDialog({ manifest, onDone }: { manifest: ComponentManifest; onDone: (c: RestoreChoice) => void }) {
  return (
    <Modal onClose={() => onDone(null)}>
      <h3>{UI.restoreTitle(manifest.name)}</h3>
      <div className="tool-dialog-text">{UI.restoreText}</div>
      <div className="modal-actions">
        <button className="btn" onClick={() => onDone(null)}>
          {UI.cancel}
        </button>
        <DeleteTwiceButton label={UI.deleteFresh} onDelete={() => onDone('delete')} />
        <button className="btn btn-primary" autoFocus onClick={() => onDone('restore')}>
          {UI.restore}
        </button>
      </div>
    </Modal>
  )
}
