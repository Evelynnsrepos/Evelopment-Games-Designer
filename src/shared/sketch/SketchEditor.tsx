import {
  Brush as BrushIcon,
  Download,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Image as ImageIcon,
  ImagePlus,
  Lasso,
  Move,
  PaintBucket,
  Pipette,
  Redo2,
  Scan,
  SquareDashed,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { importAssetFromBlob, pickAndImportAssets, resolveAssetPath } from '@/core/assets'
import { getFs } from '@/core/fs'
import { newId, type Id } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { saveBinaryFile, safeFileName } from '@/core/export'
import { SketchEngine } from './engine'
import { drawPreview } from './brushes'
import { BrushLibrary } from './BrushLibrary'
import { useBrushLibrary } from './library'
import {
  newLayer,
  nextLayerName,
  stabilize,
  type InputPoint,
  type SketchDoc,
  type SymmetryMode,
} from './model'
import { HOLD_MS, keys, outline as shapeOutline, perfect, recognize, resize, type Shape } from './quickshape'
import { ReferencePicker } from './ReferencePicker'
import { maxLayers } from './tiles'
import './sketch.css'
// Sketch Pro: layers, selections (feat/sketch-layers)
import { exportLayers, insertAbove, isGroup, lockedInTree } from './layers'
import { LayersPanel, type LayerHost } from './LayersPanel'
import { SelectionBar, SelectionMaskView, SelectionOutline } from './SelectionTools'
import { useSelector } from './selector'
import { copyPixels } from './clipboard'
import { TransformBar, TransformOverlay } from './TransformTools'
import { useTransformer } from './transformer'

const UI = {
  brush: 'Brush (B)',
  eraser: 'Eraser (E)',
  lasso: 'Lasso selection (L)',
  rectSelect: 'Rectangle selection (M)',
  move: 'Move (V): drags the selection, or the whole layer',
  eyedropper: 'Eyedropper (I, or hold Alt)',
  hand: 'Pan (H, or hold Space)',
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',
  fill: 'Fill the selection or layer with the color',
  clear: 'Clear the selection or layer (Delete)',
  flipX: 'Flip horizontally',
  flipY: 'Flip vertically',
  deselect: 'Deselect (Ctrl+D)',
  moveSelection: 'Move selection',
  library: 'Brush library',
  fit: 'Fit to view (0)',
  reference: 'Add a reference image (floats over the canvas, not part of the picture)',
  insertImage: 'Insert an image as a new layer',
  export: 'Export as PNG',
  size: 'Size',
  opacity: 'Opacity',
  smoothing: 'Smoothing',
  symmetry: 'Mirror',
  symmetryModes: { off: 'Off', vertical: 'Left / right', horizontal: 'Top / bottom', quad: 'Four ways' } as Record<SymmetryMode, string>,
  layers: 'Layers',
  addLayer: 'New layer',
  layerLimit: (n: number) => `This canvas holds at most ${n} layers in memory. Merge or delete layers to add more.`,
  duplicate: 'Duplicate',
  mergeDown: 'Merge down',
  deleteLayer: 'Delete layer',
  alphaLock: 'Alpha lock: paint only on existing pixels',
  clip: 'Clipping mask: show only on the layer below',
  rename: 'Rename layer',
  background: 'Background',
  transparent: 'Transparent',
  color: 'Color',
  saving: 'Saving…',
}

type Tool = 'brush' | 'eraser' | 'lasso' | 'rect' | 'move' | 'eyedropper' | 'hand'

const TOOLS: { id: Tool; icon: LucideIcon; label: string; key: string }[] = [
  { id: 'brush', icon: BrushIcon, label: UI.brush, key: 'b' },
  { id: 'eraser', icon: Eraser, label: UI.eraser, key: 'e' },
  { id: 'lasso', icon: Lasso, label: UI.lasso, key: 'l' },
  { id: 'rect', icon: SquareDashed, label: UI.rectSelect, key: 'm' },
  { id: 'move', icon: Move, label: UI.move, key: 'v' },
  { id: 'eyedropper', icon: Pipette, label: UI.eyedropper, key: 'i' },
  { id: 'hand', icon: Hand, label: UI.hand, key: 'h' },
]

const SWATCHES = ['#111111', '#ffffff', '#e5484d', '#f08c2e', '#f5d90a', '#30a46c', '#3e8ef7', '#8e6cf0', '#d6409f', '#8d6e63']

export interface SketchEditorProps {
  doc: SketchDoc
  /** Structural changes (layers, references, background). Pixels are saved as PNG assets by the editor itself. */
  update(recipe: (d: SketchDoc) => SketchDoc): void
  /** Keyboard shortcuts only while true. */
  active: boolean
  /** Used for the export file name. */
  title: string
  /** Extra buttons in the top bar, e.g. "Send to…". They get the flattened picture on demand. */
  actions?: (flatten: () => Promise<Blob>) => ReactNode
  /** Colors shown as swatches; defaults to a basic set. */
  swatches?: string[]
  /** Extra sections at the top of the side panel. */
  panel?: ReactNode
  /** Imperative access for the host tool. */
  editorRef?: Ref<SketchEditorHandle>
}

export interface SketchEditorHandle {
  /** Put an image from the project's assets on a new layer, fitted into the canvas. */
  insertImage(path: string, name?: string): Promise<void>
  setColor(color: string): void
  color: string
}

interface View {
  x: number
  y: number
  scale: number
}

/** A raster editor: pressure brushes, layers with blend modes, selection, mirror and references (v0.5). */
export function SketchEditor({ doc, update, active, title, actions, swatches = SWATCHES, panel, editorRef }: SketchEditorProps) {
  const root = useProjectStore((s) => s.root)
  const engineRef = useRef<SketchEngine | null>(null)
  if (!engineRef.current || engineRef.current.width !== doc.width || engineRef.current.height !== doc.height) {
    // oxlint-disable-next-line react/refs -- the engine is a mutable drawing surface, created once per canvas size
    engineRef.current = new SketchEngine(doc.width, doc.height)
  }
  // oxlint-disable-next-line react/refs
  const engine = engineRef.current
  const docRef = useRef(doc)
  useEffect(() => {
    docRef.current = doc
  })

  const boxRef = useRef<HTMLDivElement>(null)
  const viewCanvas = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState<View | null>(null)
  const viewRef = useRef<View | null>(null)
  useEffect(() => {
    viewRef.current = view
  })
  const [tool, setTool] = useState<Tool>('brush')
  const sel = useSelector(engine, active, tool)
  const [libraryOpen, setLibraryOpen] = useState<'brush' | 'eraser' | null>(null)
  const [libraryAt, setLibraryAt] = useState({ x: 0, y: 0 })
  const [color, setColor] = useState('#111111')
  const [symmetry, setSymmetry] = useState<SymmetryMode>('off')
  const [activeLayerId, setActiveLayerId] = useState<Id>(doc.layers[doc.layers.length - 1]?.id ?? '')
  const [, setVersion] = useState(0)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [pickingRef, setPickingRef] = useState(false)
  const spaceDown = useRef(false)
  const altDown = useRef(false)

  const activeLayer = doc.layers.find((l) => l.id === activeLayerId) ?? doc.layers[doc.layers.length - 1]
  const xf = useTransformer(engine, sel, { active, tool, layerId: activeLayer?.id, done: (id) => markDirty(id) })
  const lib = useBrushLibrary()
  useEffect(() => {
    void useBrushLibrary.getState().load()
  }, [])
  const brushMode = tool === 'eraser' ? 'eraser' : 'brush'
  const brush = lib.brushes.find((b) => b.id === (brushMode === 'eraser' ? lib.eraserId : lib.brushId)) ?? lib.brushes[0]
  // The sliders change the brush itself and are remembered.
  const setBrush = (patch: Partial<typeof brush>) => lib.updateBrush(brush.id, patch)

  // ---- Loading and saving layer pixels -------------------------------------

  /** Layer id -> the asset path its pixels came from or were last saved to. */
  const loaded = useRef(new Map<Id, string | null>())
  const dirty = useRef(new Set<Id>())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!root) return
    // No cancel on cleanup: a stale result is dropped by the path check below, and
    // cancelling would lose loads when effects run twice (React strict mode).
    for (const layer of doc.layers) {
      if (isGroup(layer)) continue
      if (dirty.current.has(layer.id) || loaded.current.get(layer.id) === layer.image) continue
      if (loaded.current.has(layer.id) && engine.stroking) continue
      loaded.current.set(layer.id, layer.image)
      if (!layer.image) {
        engine.setLayerImage(layer.id, null)
        setVersion(engine.version)
        continue
      }
      const path = layer.image
      // Read through the file system (same-origin blob) so the canvas is never tainted and can be saved again.
      void resolveAssetPath(root, path)
        .then((abs) => getFs().readBinary(abs))
        .then((bytes) => createImageBitmap(new Blob([bytes as BlobPart])))
        .then((bmp) => {
          if (loaded.current.get(layer.id) !== path) return
          engine.setLayerImage(layer.id, bmp)
          setVersion(engine.version)
        })
        .catch(() => {})
    }
    for (const id of [...loaded.current.keys()]) {
      if (!doc.layers.some((l) => l.id === id)) {
        loaded.current.delete(id)
        engine.dropLayer(id)
      }
    }
  }, [doc.layers, root, engine])

  const flush = useCallback(async () => {
    if (!root || !dirty.current.size) return
    const ids = [...dirty.current]
    dirty.current.clear()
    setSaving(true)
    const saved = new Map<Id, string | null>()
    for (const id of ids) {
      if (!docRef.current.layers.some((l) => l.id === id)) continue
      if (engine.isEmpty(id)) saved.set(id, null)
      else {
        const asset = await importAssetFromBlob(root, await engine.layerPng(id), 'image', 'layer.png')
        if (asset) saved.set(id, asset.path)
      }
    }
    const old: string[] = []
    for (const [id, path] of saved) {
      const prev = loaded.current.get(id)
      if (prev && prev !== path) old.push(prev)
      loaded.current.set(id, path)
    }
    // The sticker: the whole picture without background.
    const sticker = await importAssetFromBlob(root, await engine.flattenedPng({ ...docRef.current, layers: exportLayers(docRef.current.layers) }, false), 'image', 'sticker.png')
    if (docRef.current.sticker) old.push(docRef.current.sticker)
    update((d) => ({ ...d, sticker: sticker?.path ?? null, layers: d.layers.map((l) => (saved.has(l.id) ? { ...l, image: saved.get(l.id)! } : l)) }))
    // Each save writes a new PNG (assets are write-once); remove the ones this editor replaced.
    for (const p of old) void resolveAssetPath(root, p).then((abs) => getFs().remove(abs).catch(() => {}))
    setSaving(false)
  }, [root, engine, update])

  const markDirty = useCallback(
    (id: Id | null) => {
      if (!id) return
      dirty.current.add(id)
      setVersion(engine.version)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => void flush(), 1200)
    },
    [engine, flush],
  )

  // Save on unmount (closing the panel or the app).
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      void flush()
    },
    [flush],
  )

  // ---- View ---------------------------------------------------------------

  const fit = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const scale = Math.min((box.clientWidth - 40) / doc.width, (box.clientHeight - 40) / doc.height, 1)
    setView({ scale, x: (box.clientWidth - doc.width * scale) / 2, y: (box.clientHeight - doc.height * scale) / 2 })
  }, [doc.width, doc.height])

  useEffect(() => {
    if (!view) fit()
  }, [view, fit])

  // Redraw the visible canvas.
  useEffect(() => {
    const canvas = viewCanvas.current
    const box = boxRef.current
    if (!canvas || !box || !view) return
    const dpr = window.devicePixelRatio || 1
    const w = box.clientWidth
    const h = box.clientHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.translate(view.x, view.y)
    ctx.scale(view.scale, view.scale)
    // Transparent: nothing is drawn behind the picture, so the app's own background and wallpaper show through.
    ctx.imageSmoothingEnabled = view.scale < 1
    ctx.drawImage(engine.render(doc), 0, 0)
    ctx.restore()
    // Transparent pages are just a white outline over the app's wallpaper.
    ctx.strokeStyle = doc.backgroundColor ? 'rgba(128,128,128,0.6)' : '#ffffff'
    ctx.lineWidth = doc.backgroundColor ? 1 : 1.5
    ctx.strokeRect(view.x - 0.5, view.y - 0.5, doc.width * view.scale + 1, doc.height * view.scale + 1)
  })

  const toDoc = (e: { clientX: number; clientY: number }) => {
    const r = viewCanvas.current!.getBoundingClientRect()
    const v = viewRef.current!
    return { x: (e.clientX - r.left - v.x) / v.scale, y: (e.clientY - r.top - v.y) / v.scale }
  }

  // ---- Pointer input ------------------------------------------------------

  const gesture = useRef<
    | {
        kind: 'paint'
        smooth: InputPoint
        /** Every point so far, for QuickShape. */
        pts: InputPoint[]
        /** Where the pointer rests; the hold timer restarts when it moves. */
        rest: { x: number; y: number }
        timer?: ReturnType<typeof setTimeout>
        /** Set once the stroke snapped to a shape; further moves resize it. */
        snapped?: { shape: Shape; at: { x: number; y: number }; pressure: number }
      }
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
    | { kind: 'select'; pts: { x: number; y: number }[]; rect: boolean }
    | { kind: 'move'; from: { x: number; y: number }; to: { x: number; y: number } }
    | null
  >(null)

  const pressureOf = (e: PointerEvent | React.PointerEvent) => (e.pointerType === 'pen' ? Math.max(0.05, e.pressure) : 1)

  const effectiveTool = (): Tool => (spaceDown.current ? 'hand' : altDown.current && (tool === 'brush' || tool === 'eraser') ? 'eyedropper' : tool)

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!view || !activeLayer) return
    const t = e.button === 1 ? 'hand' : effectiveTool()
    if (e.button !== 0 && e.button !== 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toDoc(e)
    if (t === 'hand') {
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
    } else if (t === 'eyedropper') {
      const picked = engine.pickColor(doc, p.x, p.y)
      if (picked) setColor(picked)
    } else if (t === 'brush' || t === 'eraser') {
      if (!activeLayer.visible || isGroup(activeLayer) || lockedInTree(doc.layers, activeLayer.id)) return
      const pt = { ...p, pressure: pressureOf(e) }
      engine.beginStroke({ layer: activeLayer, brush, color, symmetry, erase: t === 'eraser' }, pt)
      gesture.current = { kind: 'paint', smooth: pt, pts: [pt], rest: pt }
      armHold()
      setVersion(engine.version)
    } else if (t === 'lasso' || t === 'rect') {
      gesture.current = { kind: 'select', pts: [p], rect: t === 'rect' }
      const ref = doc.layers.find((l) => l.reference && !isGroup(l))
      sel.down(p, e, () => engine.pixels(doc, ref?.id ?? null))
    } else if (t === 'move') {
      if (!activeLayer.visible || isGroup(activeLayer) || lockedInTree(doc.layers, activeLayer.id)) return
      // Transform: the first press lifts the pixels; later presses move, scale, turn or bend them.
      if (!xf.active && !xf.begin(activeLayer.id)) return
      xf.down(p, view.scale)
      gesture.current = { kind: 'move', from: p, to: p }
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!view) return
    const p = toDoc(e)
    setCursor(p)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pan') {
      setView({ ...view, x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy })
    } else if (g.kind === 'paint') {
      if (g.snapped) {
        g.snapped.at = g.snapped.at ?? p
        drawShape(g, p)
        return
      }
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
      for (const ev of events.length ? events : [e.nativeEvent]) {
        const raw = { ...toDoc(ev), pressure: pressureOf(ev) }
        g.smooth = stabilize(g.smooth, raw, brush.streamline)
        engine.strokeTo(g.smooth)
        g.pts.push(g.smooth)
      }
      // QuickShape: the hold timer restarts whenever the pointer really moves.
      if (Math.hypot(p.x - g.rest.x, p.y - g.rest.y) * (view?.scale ?? 1) > 4) {
        g.rest = p
        armHold()
      }
      setVersion(engine.version)
    } else if (g.kind === 'select') {
      sel.move(p, e)
    } else if (g.kind === 'move') {
      xf.move(p, view.scale, e.shiftKey)
    }
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.kind === 'paint') {
      clearTimeout(g.timer)
      markDirty(engine.endStroke())
    }
    else if (g.kind === 'select') {
      sel.up(viewRef.current?.scale ?? 1)
    } else if (g.kind === 'move') {
      xf.up()
    }
  }

  /** QuickShape: after resting HOLD_MS at the end of a stroke it snaps to a clean shape. */
  const armHold = () => {
    const g = gesture.current
    if (g?.kind !== 'paint') return
    clearTimeout(g.timer)
    g.timer = setTimeout(() => {
      if (gesture.current !== g || g.snapped) return
      const shape = recognize(g.pts)
      if (!shape) return
      const pressure = g.pts.reduce((s, q) => s + q.pressure, 0) / g.pts.length
      g.snapped = { shape, at: g.rest, pressure }
      drawShape(g, g.rest)
    }, HOLD_MS)
  }

  /** Draw the snapped shape, resized toward `to`; Shift makes it perfect. */
  const drawShape = (g: Extract<NonNullable<typeof gesture.current>, { kind: 'paint' }>, to: { x: number; y: number }) => {
    if (!g.snapped) return
    let shape = resize(g.snapped.shape, g.snapped.at, to)
    if (keys.shift) shape = perfect(shape)
    engine.restroke(shapeOutline(shape, 2, g.pts[0]).map((q) => ({ ...q, pressure: g.snapped!.pressure })))
    setVersion(engine.version)
  }

  const onWheel = (e: React.WheelEvent) => {
    if (!view) return
    const r = viewCanvas.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const scale = Math.min(32, Math.max(0.05, view.scale * Math.exp(-e.deltaY * 0.0015)))
    setView({ scale, x: mx - ((mx - view.x) * scale) / view.scale, y: my - ((my - view.y) * scale) / view.scale })
  }

  // ---- Commands ------------------------------------------------------------

  const undo = () => markDirty(engine.undo())
  const redo = () => markDirty(engine.redo())

  const layerLimit = maxLayers(doc.width, doc.height)
  const layerHost: LayerHost = {
    doc,
    update,
    engine,
    activeId: activeLayer?.id,
    setActive: setActiveLayerId,
    markDirty,
    adopt: (id) => loaded.current.set(id, null),
    discard: (gone) => {
      for (const l of gone) {
        dirty.current.delete(l.id)
        if (l.image && root) void resolveAssetPath(root, l.image).then((abs) => getFs().remove(abs).catch(() => {}))
      }
    },
    limit: layerLimit,
    title,
    color,
    selectFrom: (canvas) => sel.fromCanvas(canvas),
  }

  const insertImage = async (path: string, name = 'Image') => {
    if (!root) return
    const bytes = await getFs().readBinary(await resolveAssetPath(root, path))
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart]))
    const layer = newLayer(name)
    const s = Math.min(1, (doc.width * 0.8) / bmp.width, (doc.height * 0.8) / bmp.height)
    const w = bmp.width * s
    const h = bmp.height * s
    loaded.current.set(layer.id, null)
    engine.setLayerImage(layer.id, null)
    engine.edit(layer.id, (ctx) => ctx.drawImage(bmp, (doc.width - w) / 2, (doc.height - h) / 2, w, h))
    const i = docRef.current.layers.findIndex((l) => l.id === activeLayer?.id)
    update((d) => ({ ...d, layers: [...d.layers.slice(0, i + 1), layer, ...d.layers.slice(i + 1)] }))
    setActiveLayerId(layer.id)
    setTool('move')
    markDirty(layer.id)
  }

  const insertFromFile = async () => {
    if (!root) return
    for (const a of await pickAndImportAssets(root, 'image')) await insertImage(a.path, a.name.replace(/\.[^.]+$/, ''))
  }

  useImperativeHandle(editorRef, () => ({ insertImage, setColor, color }))

  const exportPng = async () => {
    await saveBinaryFile({
      title: UI.export,
      defaultName: `${safeFileName(title)}.png`,
      bytes: new Uint8Array(await (await engine.flattenedPng({ ...doc, layers: exportLayers(doc.layers) })).arrayBuffer()),
      filter: { name: 'PNG image', extensions: ['png'] },
    })
  }

  // ---- Keyboard -------------------------------------------------------------

  const drawShapeRef = useRef(drawShape)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    drawShapeRef.current = drawShape
    cursorRef.current = cursor
  })
  const commands = useRef({ undo, redo, fit, deselect: () => sel.clear(), clear: () => activeLayer && markDirty(engine.clear(activeLayer.id)) })
  useEffect(() => {
    commands.current = { undo, redo, fit, deselect: () => sel.clear(), clear: () => activeLayer && markDirty(engine.clear(activeLayer.id)) }
  })

  useEffect(() => {
    if (!active) return
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]')) return
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (k === 'shift' && gesture.current?.kind === 'paint' && gesture.current.snapped) {
        keys.shift = true
        drawShapeRef.current(gesture.current, cursorRef.current ?? gesture.current.snapped.at)
      }
      if (k === ' ') {
        spaceDown.current = true
        e.preventDefault()
      } else if (k === 'alt') altDown.current = true
      else if (ctrl && k === 'z' && !e.shiftKey) commands.current.undo()
      else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) commands.current.redo()
      else if (ctrl && k === 'd') commands.current.deselect()
      else if (k === 'delete' || k === 'backspace') commands.current.clear()
      else if (k === '0') commands.current.fit()
      else if (k === '[' || k === ']') {
        const st = useBrushLibrary.getState()
        const b = st.brushes.find((x) => x.id === (tool === 'eraser' ? st.eraserId : st.brushId))
        if (b) st.updateBrush(b.id, { size: Math.max(1, Math.min(500, Math.round(b.size * (k === ']' ? 1.2 : 1 / 1.2)))) })
      } else if (!ctrl && !e.altKey) {
        const t = TOOLS.find((x) => x.key === k)
        if (!t) return
        setTool(t.id)
      } else return
      e.preventDefault()
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && gesture.current?.kind === 'paint' && gesture.current.snapped) {
        keys.shift = false
        drawShapeRef.current(gesture.current, cursorRef.current ?? gesture.current.snapped.at)
      }
      if (e.key === ' ') spaceDown.current = false
      if (e.key === 'Alt') altDown.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [active, tool])

  // ---- Render --------------------------------------------------------------

  const cursorSize = (tool === 'brush' || tool === 'eraser') && cursor && view ? brush.size * view.scale : 0

  return (
    <div className="sketch">
      <div className="sketch-topbar" onPointerDown={(e) => e.stopPropagation()}>
        {TOOLS.map((t) => (
          <ToolButton key={t.id} icon={t.icon} label={t.label} active={tool === t.id} onClick={() => setTool(t.id)} />
        ))}
        <span className="sketch-sep" />
        <ToolButton icon={Undo2} label={UI.undo} onClick={undo} disabled={!engine.canUndo} />
        <ToolButton icon={Redo2} label={UI.redo} onClick={redo} disabled={!engine.canRedo} />
        <span className="sketch-sep" />
        <ToolButton icon={PaintBucket} label={UI.fill} onClick={() => activeLayer && markDirty(engine.fill(activeLayer.id, color, activeLayer.alphaLock))} />
        <ToolButton icon={Trash2} label={UI.clear} onClick={() => activeLayer && markDirty(engine.clear(activeLayer.id))} />
        <ToolButton icon={FlipHorizontal2} label={UI.flipX} onClick={() => activeLayer && markDirty(engine.flip(activeLayer.id, 'x'))} />
        <ToolButton icon={FlipVertical2} label={UI.flipY} onClick={() => activeLayer && markDirty(engine.flip(activeLayer.id, 'y'))} />
        {sel.active && (
          <>
            <button className={`btn sketch-move-sel${tool === 'move' ? ' is-active' : ''}`} title={UI.moveSelection} onClick={() => setTool('move')}>
              <Move size={14} /> {UI.moveSelection}
            </button>
            <ToolButton icon={X} label={UI.deselect} onClick={() => sel.clear()} />
          </>
        )}
        <span className="sketch-sep" />
        <ToolButton icon={Scan} label={UI.fit} onClick={fit} />
        <ToolButton icon={ImageIcon} label={UI.insertImage} onClick={() => void insertFromFile()} />
        <ToolButton icon={ImagePlus} label={UI.reference} onClick={() => setPickingRef(true)} />
        <ToolButton icon={Download} label={UI.export} onClick={() => void exportPng()} />
        {actions?.(async () => {
          await flush()
          return engine.flattenedPng({ ...doc, layers: exportLayers(doc.layers) })
        })}
        <span className="sketch-spacer" />
        {saving && <span className="sketch-saving">{UI.saving}</span>}
      </div>

      <div className="sketch-body">
        <div
          ref={boxRef}
          className={`sketch-stage${doc.backgroundColor ? '' : ' see-through'}`}
          onWheel={onWheel}
          style={{ cursor: tool === 'hand' ? 'grab' : tool === 'brush' || tool === 'eraser' ? 'none' : 'crosshair' }}
        >
          <canvas
            ref={viewCanvas}
            className="sketch-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              engine.cancelStroke()
              xf.up()
              gesture.current = null
            }}
            onPointerLeave={() => setCursor(null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          {view && <SelectionMaskView sel={sel} engine={engine} view={view} />}
          <div className="sketch-floatbars">
            <TransformBar xf={xf} onDone={() => markDirty(xf.commit(sel))} onCancel={() => xf.cancel()} />
            <SelectionBar
              sel={sel}
              tool={tool === 'lasso' || tool === 'rect'}
              doc={doc}
              root={root}
              update={update}
              usesReference={doc.layers.some((l) => l.reference)}
              onFill={() => activeLayer && markDirty(engine.fill(activeLayer.id, color, activeLayer.alphaLock))}
              onClear={() => activeLayer && markDirty(engine.clear(activeLayer.id))}
              onCopyPaste={() => {
                if (!activeLayer || isGroup(activeLayer)) return
                const piece = engine.canvas()
                piece.ctx.drawImage(engine.layerCanvas(activeLayer.id), 0, 0)
                piece.ctx.globalCompositeOperation = 'destination-in'
                if (engine.selectionMask) piece.ctx.drawImage(engine.selectionMask, 0, 0)
                copyPixels(piece.canvas)
                const layer = newLayer(nextLayerName(doc))
                loaded.current.set(layer.id, null)
                engine.setLayerImage(layer.id, piece.canvas)
                update((d) => ({ ...d, layers: insertAbove(d.layers, layer, activeLayer.id) }))
                setActiveLayerId(layer.id)
                markDirty(layer.id)
              }}
            />
          </div>
          {view && (
            <svg className="sketch-overlay">
              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                {(symmetry === 'vertical' || symmetry === 'quad') && <line x1={doc.width / 2} y1={0} x2={doc.width / 2} y2={doc.height} className="sketch-guide" />}
                {(symmetry === 'horizontal' || symmetry === 'quad') && <line x1={0} y1={doc.height / 2} x2={doc.width} y2={doc.height / 2} className="sketch-guide" />}
                <SelectionOutline sel={sel} />
                <TransformOverlay xf={xf} scale={view.scale} width={doc.width} height={doc.height} />
              </g>
              {cursorSize > 0 && cursor && (
                <circle cx={view.x + cursor.x * view.scale} cy={view.y + cursor.y * view.scale} r={Math.max(1.5, cursorSize / 2)} className="sketch-cursor" />
              )}
            </svg>
          )}
          {doc.references.map((r) => (
            <ReferenceWindow
              key={r.id}
              image={r.image}
              x={r.x}
              y={r.y}
              width={r.width}
              onChange={(patch) => update((d) => ({ ...d, references: d.references.map((x) => (x.id === r.id ? { ...x, ...patch } : x)) }))}
              onClose={() => update((d) => ({ ...d, references: d.references.filter((x) => x.id !== r.id) }))}
            />
          ))}
        </div>

        <aside className="sketch-panel" onPointerDown={(e) => e.stopPropagation()}>
          {panel}
          <section>
            <h4>{UI.color}</h4>
            <div className="sketch-colors">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={UI.color} />
              {swatches.map((s) => (
                <button key={s} className={`sketch-swatch${s === color ? ' is-active' : ''}`} style={{ background: s }} title={s} onClick={() => setColor(s)} />
              ))}
            </div>
          </section>

          <section>
            <div className="sketch-current-brush">
              <button className="sketch-brush-pick" title={UI.library} onClick={(e) => {
                  // Opens to the left of the side panel, over the canvas.
                  const r = e.currentTarget.getBoundingClientRect()
                  setLibraryAt({ x: Math.max(8, r.left - 572), y: Math.max(8, Math.min(r.top, window.innerHeight - 470)) })
                  setLibraryOpen(libraryOpen ? null : brushMode)
                }}>
                <span>{brush.name}</span>
                <BrushPreview brush={brush} color={brushMode === 'eraser' ? '#888' : color} />
              </button>
              {libraryOpen && <BrushLibrary mode={libraryOpen} color={color} at={libraryAt} onClose={() => setLibraryOpen(null)} />}
            </div>
            <Slider label={UI.size} min={1} max={500} value={brush.size} log onChange={(size) => setBrush({ size })} suffix="px" />
            <Slider label={UI.opacity} min={0.05} max={1} step={0.05} value={brush.opacity} onChange={(opacity) => setBrush({ opacity })} percent />
            <Slider label={UI.smoothing} min={0} max={1} step={0.05} value={brush.streamline} onChange={(streamline) => setBrush({ streamline })} percent />
            <label className="sketch-row">
              <span>{UI.symmetry}</span>
              <select className="input" value={symmetry} onChange={(e) => setSymmetry(e.target.value as SymmetryMode)}>
                {(Object.keys(UI.symmetryModes) as SymmetryMode[]).map((m) => (
                  <option key={m} value={m}>
                    {UI.symmetryModes[m]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <LayersPanel host={layerHost} />
        </aside>
      </div>

      {pickingRef && (
        <ReferencePicker
          onPick={(image) => {
            setPickingRef(false)
            if (image) update((d) => ({ ...d, references: [...d.references, { id: newId(), image, x: 24, y: 24 + d.references.length * 24, width: 260 }] }))
          }}
        />
      )}
    </div>
  )
}

function ToolButton(p: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button className={`icon-btn sketch-tool${p.active ? ' is-active' : ''}`} title={p.label} aria-label={p.label} aria-pressed={p.active} disabled={p.disabled} onClick={p.onClick}>
      <p.icon size={16} />
    </button>
  )
}

function Slider(p: { label: string; min: number; max: number; step?: number; value: number; onChange(v: number): void; log?: boolean; percent?: boolean; suffix?: string }) {
  // Size uses a log scale so small brushes are easy to set.
  const toSlider = (v: number) => (p.log ? Math.log(v / p.min) / Math.log(p.max / p.min) : v)
  const fromSlider = (s: number) => (p.log ? Math.round(p.min * Math.pow(p.max / p.min, s)) : s)
  const shown = p.percent ? `${Math.round(p.value * 100)}%` : `${Math.round(p.value)}${p.suffix ?? ''}`
  return (
    <label className="sketch-slider">
      <span>{p.label}</span>
      <input
        type="range"
        min={p.log ? 0 : p.min}
        max={p.log ? 1 : p.max}
        step={p.log ? 0.001 : (p.step ?? 1)}
        value={toSlider(p.value)}
        onChange={(e) => p.onChange(fromSlider(Number(e.target.value)))}
      />
      <span className="sketch-slider-value">{shown}</span>
    </label>
  )
}

function ReferenceWindow(p: { image: string; x: number; y: number; width: number; onChange(patch: { x?: number; y?: number; width?: number }): void; onClose(): void }) {
  const root = useProjectStore((s) => s.root)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!root) return
    let gone = false
    let made: string | null = null
    void resolveAssetPath(root, p.image)
      .then((abs) => getFs().readBinary(abs))
      .then((bytes) => {
        made = URL.createObjectURL(new Blob([bytes as BlobPart]))
        if (!gone) setUrl(made)
      })
      .catch(() => {})
    return () => {
      gone = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [root, p.image])

  const drag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const sx = e.clientX
    const sy = e.clientY
    const start = { x: p.x, y: p.y, width: p.width }
    const move = (ev: PointerEvent) =>
      p.onChange(mode === 'move' ? { x: start.x + ev.clientX - sx, y: start.y + ev.clientY - sy } : { width: Math.max(80, start.width + ev.clientX - sx) })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="sketch-ref" style={{ left: p.x, top: p.y, width: p.width }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="sketch-ref-bar" onPointerDown={drag('move')}>
        <button className="icon-btn" title="Close reference" onPointerDown={(e) => e.stopPropagation()} onClick={p.onClose}>
          <X size={12} />
        </button>
      </div>
      {url ? <img src={url} alt="" draggable={false} /> : <div className="placeholder-image sketch-ref-missing" />}
      <div className="sketch-ref-resize" onPointerDown={drag('resize')} />
    </div>
  )
}

function BrushPreview({ brush, color }: { brush: Parameters<typeof drawPreview>[1]; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawPreview(ref.current, brush, color)
  }, [brush, color])
  return <canvas ref={ref} width={200} height={40} className="sketch-brush-preview" />
}
