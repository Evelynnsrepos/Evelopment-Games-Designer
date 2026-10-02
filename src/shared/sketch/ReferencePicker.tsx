import { useEffect, useState } from 'react'
import { pickAndImportAssets, useAssetUrls } from '@/core/assets'
import { getFs } from '@/core/fs'
import type { AssetPath } from '@/core/model'
import { projectPaths } from '@/core/project'
import { useProjectStore } from '@/core/state'
import { Modal } from '../ui'

const UI = {
  title: 'Add a reference image',
  hint: 'Every image in this project: moodboards, the Design Language, the Asset Pool, items and more.',
  none: 'This project has no images yet.',
  fromFile: 'From a file…',
  cancel: 'Cancel',
}

/** All images in the project's assets folder, newest first. */
export function useProjectImageList(): AssetPath[] | null {
  const root = useProjectStore((s) => s.root)
  const [list, setList] = useState<AssetPath[] | null>(null)
  useEffect(() => {
    if (!root) return
    let gone = false
    void projectPaths.imagesDir(root).then(async (dir) => {
      const fs = getFs()
      const entries = (await fs.exists(dir)) ? await fs.list(dir) : []
      if (!gone) setList(entries.filter((e) => !e.isDirectory && !e.name.endsWith('.tmp')).map((e) => `assets/images/${e.name}`).reverse())
    })
    return () => {
      gone = true
    }
  }, [root])
  return list
}

/** Choose a project image (or import one) to float over the canvas while drawing. */
export function ReferencePicker({ onPick }: { onPick: (image: AssetPath | null) => void }) {
  const root = useProjectStore((s) => s.root)
  const images = useProjectImageList()
  const urlOf = useAssetUrls(images ?? [])
  const fromFile = async () => {
    if (!root) return
    const [asset] = await pickAndImportAssets(root, 'image')
    onPick(asset?.path ?? null)
  }
  return (
    <Modal onClose={() => onPick(null)}>
      <div className="sketch-picker">
        <h3>{UI.title}</h3>
        <p className="muted">{UI.hint}</p>
        <div className="sketch-picker-grid">
          {images?.length === 0 && <p className="muted">{UI.none}</p>}
          {images?.map((p) => (
            <button key={p} className="sketch-picker-item" onClick={() => onPick(p)}>
              {urlOf(p) ? <img src={urlOf(p)} alt="" /> : <div className="placeholder-image" />}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => onPick(null)}>
            {UI.cancel}
          </button>
          <button className="btn btn-primary" onClick={() => void fromFile()}>
            {UI.fromFile}
          </button>
        </div>
      </div>
    </Modal>
  )
}
