import { Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { importAssetFromBlob, resolveAssetPath, useAssetUrls, type ImportedAsset } from '@/core/assets'
import { getFs } from '@/core/fs'
import { readDocument } from '@/core/project'
import { flushAll, useProjectStore } from '@/core/state'
import type { SketchDoc } from '@/shared/sketch'
import { newDocument, openComponent } from '@/shell/editor/actions'

const UI = {
  title: 'Drawings',
  hint: 'Click a drawing to place it as a sticker. Transparent parts stay see-through.',
  none: 'No drawings yet. Make one in the Sketch tool.',
  newDrawing: 'New drawing',
  open: 'Double-click to edit it in Sketch',
  close: 'Close',
}

interface Item {
  id: string
  title: string
  sticker: string | null
}

/** Side drawer listing the project's Sketch drawings to place on the board as stickers (v0.5). */
export function DrawingDrawer({ onPlace, onClose }: { onPlace: (asset: ImportedAsset) => void; onClose: () => void }) {
  const root = useProjectStore((s) => s.root)
  const documents = useProjectStore((s) => s.meta?.documents)
  const key = useMemo(() => (documents ?? []).filter((d) => d.type === 'sketch').map((d) => `${d.id}:${d.title}`).join(','), [documents])
  const [items, setItems] = useState<Item[] | null>(null)
  const urlOf = useAssetUrls(items?.map((i) => i.sticker) ?? [])

  useEffect(() => {
    if (!root) return
    let gone = false
    // Saved drawings only; write pending edits first so the newest strokes are in.
    void flushAll(root).then(async () => {
      const list: Item[] = []
      for (const d of useProjectStore.getState().meta?.documents.filter((x) => x.type === 'sketch') ?? []) {
        const data = await readDocument<Partial<SketchDoc> | null>(root, 'sketch', d.id, () => null).catch(() => null)
        list.push({ id: d.id, title: d.title, sticker: data?.sticker ?? null })
      }
      if (!gone) setItems(list)
    })
    return () => {
      gone = true
    }
  }, [root, key])

  const place = async (item: Item) => {
    if (!root || !item.sticker) return
    // A copy, so later edits to the drawing don't change (or remove) the sticker.
    const bytes = await getFs().readBinary(await resolveAssetPath(root, item.sticker))
    const asset = await importAssetFromBlob(root, new Blob([bytes as BlobPart], { type: 'image/png' }), 'image', `${item.title}.png`)
    if (asset) onPlace({ ...asset, name: item.title })
  }

  return (
    <aside className="moodboard-drawer">
      <div className="moodboard-drawer-head">
        <h4>{UI.title}</h4>
        <button className="icon-btn" title={UI.newDrawing} onClick={() => newDocument('sketch')}>
          <Plus size={15} />
        </button>
        <button className="icon-btn" title={UI.close} onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <p className="muted moodboard-drawer-hint">{UI.hint}</p>
      <div className="moodboard-drawer-list">
        {items?.length === 0 && <p className="muted">{UI.none}</p>}
        {items?.map((i) => (
          <button key={i.id} className="moodboard-drawer-item" title={UI.open} disabled={!i.sticker} onClick={() => void place(i)} onDoubleClick={() => openComponent('sketch', i.id)}>
            <div className="moodboard-drawer-thumb">{i.sticker && urlOf(i.sticker) ? <img src={urlOf(i.sticker)} alt="" /> : null}</div>
            <span>{i.title}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
