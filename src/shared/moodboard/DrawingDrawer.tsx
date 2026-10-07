import { Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAssetUrls, type ImportedAsset } from '@/core/assets'
import { useProjectStore } from '@/core/state'
import { copyDrawing, loadDrawings, type Drawing as Item } from '@/shared/drawingShelf'
import { newDocument, openComponent } from '@/shell/editor/actions'

const UI = {
  title: 'Drawings',
  hint: 'Click a drawing to place it as a sticker. Transparent parts stay see-through.',
  none: 'No drawings yet. Make one in the Draw tool.',
  newDrawing: 'New drawing',
  open: 'Double-click to edit it in Draw',
  close: 'Close',
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
    void loadDrawings(root).then((list) => !gone && setItems(list))
    return () => {
      gone = true
    }
  }, [root, key])

  const place = async (item: Item) => {
    const asset = root && (await copyDrawing(root, item))
    if (asset) onPlace(asset)
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
