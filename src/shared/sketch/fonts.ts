import { useEffect, useState } from 'react'
import { resolveAssetPath } from '@/core/assets'
import { getFs } from '@/core/fs'
import { newId, type AssetPath } from '@/core/model'
import type { SketchDoc } from './model'
import { fontName, splitFontFile } from './text'

/**
 * Fonts for text layers (Sketch Pro). The app ships no font files, so the list
 * is the browser's generic families, common system fonts that are really
 * installed, every local font when the webview lets us list them, and fonts
 * imported into the drawing (TTF, OTF, TTC) through the FontFace API.
 */

export const GENERIC_FONTS = ['sans-serif', 'serif', 'monospace', 'cursive']

const COMMON_FONTS = [
  'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New',
  'Franklin Gothic Medium', 'Gabriola', 'Georgia', 'Impact', 'Ink Free', 'Lucida Console', 'Palatino Linotype', 'Segoe Print', 'Segoe Script',
  'Segoe UI', 'Sitka Text', 'Sylfaen', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Yu Gothic', 'Meiryo', 'MS Gothic', 'Malgun Gothic',
  'Microsoft YaHei', 'Helvetica', 'Helvetica Neue', 'Avenir', 'Futura', 'Gill Sans', 'Menlo', 'Monaco', 'Optima', 'Baskerville', 'Didot',
  'American Typewriter', 'Chalkboard', 'Marker Felt', 'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans', 'Liberation Serif',
  'Liberation Mono', 'Noto Sans', 'Noto Serif', 'Noto Sans CJK JP', 'Ubuntu', 'Ubuntu Mono', 'Cantarell', 'Fira Sans', 'Roboto', 'Open Sans',
  'Source Sans Pro', 'Inter', 'Lato', 'Montserrat', 'Comfortaa', 'Droid Sans',
]

/** True when `family` is installed: text in it measures differently from every fallback. */
function installed(ctx: CanvasRenderingContext2D, family: string): boolean {
  const sample = 'mmmmmmmmmlli10WQ@'
  return ['monospace', 'serif', 'sans-serif'].some((fb) => {
    ctx.font = `40px ${fb}`
    const base = ctx.measureText(sample).width
    ctx.font = `40px "${family}", ${fb}`
    return ctx.measureText(sample).width !== base
  })
}

let systemCache: string[] | null = null

/** Common fonts that are installed on this computer. */
export function systemFonts(): string[] {
  if (systemCache) return systemCache
  const ctx = document.createElement('canvas').getContext('2d')
  systemCache = ctx ? COMMON_FONTS.filter((f) => installed(ctx, f)) : []
  return systemCache
}

/** Every local font family, where the webview allows it (it may ask the user first). Empty when it can't. */
export async function allLocalFonts(): Promise<string[]> {
  const q = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts
  if (!q) return []
  try {
    return [...new Set((await q()).map((f) => f.family))].sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/** Families already handed to the browser, by file path. */
const registered = new Map<string, Promise<boolean>>()

function register(root: string, family: string, file: AssetPath): Promise<boolean> {
  const key = `${file}|${family}`
  let p = registered.get(key)
  if (!p) {
    p = resolveAssetPath(root, file)
      .then((abs) => getFs().readBinary(abs))
      .then(async (bytes) => {
        const face = new FontFace(family, bytes as BufferSource)
        document.fonts.add(await face.load())
        return true
      })
      .catch(() => false)
    registered.set(key, p)
  }
  return p
}

/** Load the drawing's imported fonts; the number goes up whenever one becomes usable, so text is drawn again. */
export function useImportedFonts(root: string | null, fonts: SketchDoc['fonts']): number {
  const [ready, setReady] = useState(0)
  const key = (fonts ?? []).map((f) => `${f.file}|${f.family}`).join(',')
  useEffect(() => {
    if (!root || !fonts?.length) return
    let gone = false
    for (const f of fonts) void register(root, f.family, f.file).then((ok) => ok && !gone && setReady((n) => n + 1))
    return () => {
      gone = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the list
  }, [root, key])
  return ready
}

/** Copy a font file into the project (`assets/fonts/`), one entry per font inside it. */
export async function importFontFile(root: string, name: string, bytes: Uint8Array): Promise<NonNullable<SketchDoc['fonts']>> {
  const fs = getFs()
  const dir = await fs.join(root, 'assets', 'fonts')
  await fs.mkdir(dir)
  const base = name.replace(/\.[^.]+$/, '')
  const faces = splitFontFile(bytes)
  const out: NonNullable<SketchDoc['fonts']> = []
  for (const [i, face] of faces.entries()) {
    const ext = String.fromCharCode(...face.subarray(0, 4)) === 'OTTO' ? 'otf' : 'ttf'
    const file = `${newId()}.${ext}`
    await fs.writeBinaryAtomic(await fs.join(dir, file), face)
    out.push({ id: newId(), family: fontName(face) ?? (faces.length > 1 ? `${base} ${i + 1}` : base), file: `assets/fonts/${file}` })
  }
  return out
}
