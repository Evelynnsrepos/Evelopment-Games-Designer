# Shared canvas engine (work package C1)

One engine for every canvas component (Story Writer, Timeline, Brainstorm Board, Moodboard, Map), so they
share pan/zoom, select, move, transform, delete, undo, the bottom toolbar and the layers model (spec 10.2, 12.5).
Built on Konva via react-konva. Import everything from `@/shared/canvas`.

Try it: `npm run dev`, then open <http://localhost:5173/src/shared/canvas/playground/index.html>.
The playground (`playground/`) is dev-only and is not part of the app build.

## Minimal component

```tsx
import { useDocument } from '@/core/state'
import type { PanelProps } from '@/core/registry'
import { CanvasEditor, createScene, defaultTools, sceneBinding, type BuiltinNode, type Scene } from '@/shared/canvas'

interface BoardDoc { scene: Scene<BuiltinNode> }
const createDefault = (): BoardDoc => ({ scene: createScene() })
const tools = defaultTools() // or pick: [selectTool, handTool, rectTool(), noteTool()]

export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument('brainstorm', documentId!, createDefault)
  if (!doc.data) return null
  return <CanvasEditor scene={doc.data.scene} {...sceneBinding(doc)} active={active} tools={tools} />
}
```

`onChange` receives a recipe `(scene) => scene` and must apply it synchronously (`doc.update` does).
Drags are shown as a preview and saved as **one** undoable change on release, so undo goes back to before the drag.

## Data model

- `Scene = { layers: Layer[]; nodes: Node[] }`. Layers are bottom to top; node z-order inside a layer is array order.
- Every node has `id, kind, layerId, x, y` and optional `rotation, scaleX, scaleY, name, hidden, locked`.
- Built-in kinds: `rect`, `ellipse`, `line` (also arrow and freehand pen), `text`, `note` (sticky note), `image`, `connector`.
- `connector` joins `fromId` → `toId` and follows both ends. Deleting either end deletes it (`deleteNodes`).
  Any node with `fromId`/`toId` gets the same treatment.
- `Layer.alwaysOnTop` layers draw above all other layers (Moodboard MB-6). `ensureTopLayer(scene)` creates one.
- Colors go in `*Color` keys and asset paths in `src` so the word counter skips them (AGENTS.md).
- Pure helpers in `scene.ts` (`addNodes`, `updateNode`, `deleteNodes`, `duplicateNodes`, `reorderNodes`,
  `moveNodeInLayer`, `addLayer`, `updateLayer`, `removeLayer`, `moveLayer`, ...) all return a new scene,
  so they plug into `onChange` directly. `geometry.ts` has viewport and rectangle math.

## Custom node kinds

```tsx
interface PinNode extends NodeBase { kind: 'pin'; pinColor: string }
const pinType: NodeType<PinNode> = {
  label: 'Pin',
  render: (n, ctx) => <Circle radius={8} fill={n.pinColor} />,   // local coordinates; engine applies x/y/rotation/scale
  bounds: () => ({ x: -8, y: -8, width: 16, height: 16 }),        // local, used for selection box and hit areas
  transformable: false,                                            // no resize handles
}
<CanvasEditor nodeTypes={{ pin: pinType }} ... />
```

Options: `absolute` (drawn in world space, like connectors), `rotatable`, `keepRatio`, `resize(node, sx, sy)` to bake
a resize into width/height instead of storing scale, `textEdit` for double-click inline editing, `memo: false` when
the drawing depends on other nodes. `ctx` gives theme colors, `getNode`, `getWorldBounds` and `resolveImageSrc`.
`<CanvasImage>` draws an image or the pink/black placeholder inside custom renderers.

## Tools

A tool is `{ id, label, icon, shortcut, cursor, pointerDown, hover, keyDown, deactivate, toggle }`.
`pointerDown(e, api)` gets world and screen coordinates plus `targetId` (node under the pointer) and may return a
gesture `{ move, up, cancel }` that receives the rest of the drag. Useful API calls:

- `api.update(recipe)` saves; `api.preview(recipe)` + `api.commitPreview()` for drags; `api.setDraft(nodes)` for
  a shape being drawn; `api.select(ids, mode)`; `api.setTool(id)`; `api.editText(id, newNode?)`.
- `api.activeLayerId` is where new nodes go; `useCanvasState().setActiveLayerId` changes it.
- `api.exportPng({ pixelRatio, area })` returns a PNG data URL (Map Creator MP-7). `api.fitToContent()`.
- `startMove` and `startMarquee` from `tools.ts` reuse the select tool's behaviour inside your own tool.
- `toggle: true` makes the shortcut switch back to the first tool when pressed again (Timeline B, TL-6).
- `keyDown` returning true claims the key; for Esc that keeps the shell's Layout Mode closed (ED-7).

Built-ins: `selectTool` (V), `handTool` (H), `rectTool()` (R), `ellipseTool()` (O), `lineTool()` (L),
`arrowTool()` (A), `penTool()` (P), `textTool()` (T), `noteTool()` (N). Factories take
`{ shortcut, defaults: () => ({ strokeColor, ... }) }`, so a color picker in `toolbarExtra` can style new shapes.
Shortcuts are per component: the Story Writer can use L for Connect simply by not including `lineTool()`.

## Built-in keys and mouse (only while the panel is `active`)

| Input | Action |
|---|---|
| Wheel | Zoom at cursor (Shift+wheel pans sideways) |
| Middle mouse drag, Space+drag, hand tool | Pan |
| Click, Shift/Ctrl+click, drag on empty canvas | Select, toggle, selection box |
| Drag selection, handles | Move, resize, rotate |
| Double-click | `onNodeDoubleClick` or inline text editing |
| Delete / Backspace | Delete selection (and attached connectors), or `onDeleteNodes` |
| Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z | Undo, redo (`onUndo` / `onRedo`) |
| Ctrl+A, Ctrl+D | Select all, duplicate |
| Ctrl+] / Ctrl+[ (with Shift: to front / back) | Reorder within layer |
| Arrows (Shift: 10) | Nudge |
| + / - / 0 / Shift+1 | Zoom in, out, 100%, fit |
| Esc | Cancel the current drag or tool step, else clear selection, else the shell's Layout Mode |

## Other props

`canvas` (controlled view state from `useCanvasState()`: selection, tool, viewport, active layer), `toolbarExtra`,
`showToolbar`, `grid`, `fitOnOpen`, `resolveImageSrc` (wire to F2's asset URL resolver), `onNodeDoubleClick`,
`onDeleteNodes`, `html` (world-space HTML overlay for audio players and similar), `apiRef`.
