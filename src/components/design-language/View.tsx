import { Plus, X } from 'lucide-react'
import { useRef } from 'react'
import { newId, type Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useIntentHandler, useProjectStore } from '@/core/state'
import { promptDialog } from '@/shared/dialogs'
import { createSketchDoc, SketchEditor, type SketchDoc, type SketchEditorHandle } from '@/shared/sketch'
import './design-language.css'

const UI = {
  palette: 'Palette',
  addColor: 'Add the current brush color',
  rename: 'Name this color',
  remove: 'Remove color',
  rules: 'Style rules',
  rulesHint: 'Shapes, line weight, lighting, do and don’t…',
}

export interface PaletteColor {
  id: Id
  name: string
  color: string
}

/** A design language board: a layered drawing canvas plus the palette and written rules of the look (v0.5). */
export interface DesignLanguageDoc extends SketchDoc {
  palette: PaletteColor[]
  rules: string
}

const createDoc = (): DesignLanguageDoc => ({
  ...createSketchDoc(2560, 1440),
  layers: createSketchDoc().layers.map((l) => ({ ...l, name: 'Sketch' })),
  palette: [],
  rules: '',
})

/**
 * Design Language (v0.5): like a moodboard you can paint on. Images go in as
 * layers, everything is drawn with the Sketch brushes, and the side panel keeps
 * the palette and style rules. Intents: `add-image` ({ path, name }) puts a
 * picture on a new layer.
 */
export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<DesignLanguageDoc>('design-language', documentId!, createDoc)
  const title = useProjectStore((s) => s.meta?.documents.find((d) => d.id === documentId)?.title ?? 'Design language')
  const editor = useRef<SketchEditorHandle>(null)

  useIntentHandler(
    'design-language',
    (intent) => {
      if (intent.action !== 'add-image' || typeof intent.path !== 'string') return
      const path = intent.path
      const name = String(intent.name ?? 'Image')
      const place = (tries: number) => (editor.current ? void editor.current.insertImage(path, name) : tries > 0 && setTimeout(() => place(tries - 1), 150))
      place(20)
    },
    !!doc.data,
  )

  const d = doc.data
  if (!d) return null
  const set = (fn: (x: DesignLanguageDoc) => DesignLanguageDoc, undoable = true) => doc.update(fn, { undoable })

  const addColor = async () => {
    const color = editor.current?.color ?? '#000000'
    const name = (await promptDialog(UI.rename, color))?.trim()
    if (name) set((x) => ({ ...x, palette: [...x.palette, { id: newId(), name, color }] }))
  }

  const panel = (
    <>
      <section>
        <div className="dl-head">
          <h4>{UI.palette}</h4>
          <button className="icon-btn" title={UI.addColor} onClick={() => void addColor()}>
            <Plus size={14} />
          </button>
        </div>
        <div className="dl-palette">
          {d.palette.map((c) => (
            <div key={c.id} className="dl-color">
              <button className="dl-chip" style={{ background: c.color }} title={`${c.name} ${c.color}`} onClick={() => editor.current?.setColor(c.color)} />
              <span
                className="dl-color-name"
                onDoubleClick={async () => {
                  const name = (await promptDialog(UI.rename, c.name))?.trim()
                  if (name) set((x) => ({ ...x, palette: x.palette.map((p) => (p.id === c.id ? { ...p, name } : p)) }))
                }}
              >
                {c.name}
              </span>
              <button className="icon-btn dl-remove" title={UI.remove} onClick={() => set((x) => ({ ...x, palette: x.palette.filter((p) => p.id !== c.id) }))}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h4>{UI.rules}</h4>
        <textarea className="input dl-rules" placeholder={UI.rulesHint} value={d.rules} onChange={(e) => set((x) => ({ ...x, rules: e.target.value }))} />
      </section>
    </>
  )

  return (
    <SketchEditor
      doc={d}
      update={(fn) => set((x) => ({ ...x, ...fn(x) }), false)}
      active={active}
      title={title}
      editorRef={editor}
      swatches={d.palette.length ? d.palette.map((p) => p.color) : undefined}
      panel={panel}
    />
  )
}
