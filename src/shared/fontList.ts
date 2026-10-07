/**
 * Font families to offer in font menus (Draw text layers, the Writer, per-tool fonts). The app ships no font
 * files: the browser's generic families, common system fonts that are really installed, and every local
 * font when the webview lets us list them.
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
