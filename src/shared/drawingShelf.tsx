import { FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { create } from 'zustand'
import { importAssetFromBlob, resolveAssetPath, setImageChooser, useAssetUrls, type ImportedAsset } from '@/core/assets'
import { getFs } from '@/core/fs'
import { readDocument } from '@/core/project'
import { flushAll, useProjectStore } from '@/core/state'
import type { SketchDoc } from '@/shared/sketch'
import { Modal } from './ui'
import './drawingShelf.css'

/**
 * The drawings shelf (v0.12): everything made in Draw stays in the project, and wherever a picture
 * can be added, a window shows the drawings as stickers to pick from before the file picker.
 */
export interface Drawing {
  id: string
  title: string
  /** The whole picture without background, written by Draw on every save. */
  sticker: string | null
}

/** Every saved drawing in the project; pending edits are written first so the newest strokes are in. */
export async function loadDrawings(root: string): Promise<Drawing[]> {
  await flushAll(root)
  const list: Drawing[] = []
  for (const d of useProjectStore.getState().meta?.documents.filter((x) => x.type === 'sketch') ?? []) {
    const data = await readDocument<Partial<SketchDoc> | null>(root, 'sketch', d.id, () => null).catch(() => null)
    list.push({ id: d.id, title: d.title, sticker: data?.sticker ?? null })
  }
  return list
}

/** A copy of the drawing's picture, so later edits to the drawing don't change (or remove) it where it was placed. */
export async function copyDrawing(root: string, d: Drawing): Promise<ImportedAsset | null> {
  if (!d.sticker) return null
  const bytes = await getFs().readBinary(await resolveAssetPath(root, d.sticker))
  const asset = await importAssetFromBlob(root, new Blob([bytes as BlobPart], { type: 'image/png' }), 'image', `${d.title}.png`)
  return asset && { ...asset, name: d.title }
}

interface ShelfRequest {
  root: string
  title: string
  drawings: Drawing[]
  resolve(v: ImportedAsset[] | 'file' | null): void
}

const useShelf = create<{ request: ShelfRequest | null }>()(() => ({ request: null }))

setImageChooser(async (root, title) => {
  const drawings = (await loadDrawings(root).catch(() => [])).filter((d) => d.sticker)
  // Nothing drawn yet: straight to the file picker, as before.
  if (!drawings.length) return 'file'
  return new Promise((resolve) => useShelf.setState({ request: { root, title, drawings, resolve } }))
})

/** Mount once at the app root. */
export function DrawingShelfHost() {
  const request = useShelf((s) => s.request)
  return request ? <ShelfWindow request={request} /> : null
}

function ShelfWindow({ request }: { request: ShelfRequest }) {
  const urlOf = useAssetUrls(request.drawings.map((d) => d.sticker))
  const [busy, setBusy] = useState(false)
  const done = (v: ImportedAsset[] | 'file' | null) => {
    useShelf.setState({ request: null })
    request.resolve(v)
  }
  const pick = async (d: Drawing) => {
    setBusy(true)
    const asset = await copyDrawing(request.root, d).catch(() => null)
    done(asset ? [asset] : [])
  }
  return (
    <Modal onClose={() => done(null)}>
      <h3>{request.title}</h3>
      <p className="muted">Pick one of your drawings, or choose a file.</p>
      <div className="shelf-grid">
        {request.drawings.map((d) => (
          <button key={d.id} className="shelf-item" disabled={busy} title={d.title} onClick={() => void pick(d)}>
            <div className="shelf-thumb">{d.sticker && urlOf(d.sticker) ? <img src={urlOf(d.sticker)} alt="" /> : null}</div>
            <span>{d.title}</span>
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={() => done(null)}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => done('file')} autoFocus>
          <FolderOpen size={14} /> Choose a file…
        </button>
      </div>
    </Modal>
  )
}
