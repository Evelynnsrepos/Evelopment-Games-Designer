import { unzipSync, zipSync } from 'fflate'
import { newId } from '@/core/model'
import { parseAbr, type AbrTip } from './abr'
import { normalizeBrush, normalizeSettings, type BrushDef, type BrushSettings } from './brushes'
import { parsePlist, unarchive, type PlistValue } from './plist'

/**
 * Brush files: our own .egdbrush (a zip with brushes.json, images inside as
 * PNG data URLs), and imports of .abr, .brush and .brushset files.
 * Imported shapes and grains are kept as they are, as custom images.
 */

export const BRUSH_EXTENSIONS = ['egdbrush', 'abr', 'brush', 'brushset']

export interface ImportedSet {
  name: string
  icon?: string
  brushes: BrushDef[]
  /** Settings in the file that have no match here (per brush name). */
  unmapped: { brush: string; keys: string[] }[]
}

const FORMAT = 'egd-brushes'
const MAX_UNPACKED = 200 * 1024 * 1024

export class BrushFileError extends Error {}

// ---- Bytes and images ---------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export const pngDataUrl = (png: Uint8Array) => `data:image/png;base64,${toBase64(png)}`

/** Grayscale pixels → PNG data URL (browser only). */
function grayDataUrl(t: AbrTip): string {
  const c = document.createElement('canvas')
  c.width = t.width
  c.height = t.height
  const img = new ImageData(t.width, t.height)
  for (let i = 0; i < t.gray.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = t.gray[i]
    img.data[i * 4 + 3] = 255
  }
  c.getContext('2d')!.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

// ---- Zip safety -------------------------------------------------------------------

/** True when any entry of the zip is encrypted (read from the central directory). */
export function zipIsEncrypted(b: Uint8Array): boolean {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  for (let end = b.length - 22; end >= Math.max(0, b.length - 65557); end--) {
    if (v.getUint32(end, true) !== 0x06054b50) continue
    const count = v.getUint16(end + 10, true)
    let at = v.getUint32(end + 16, true)
    for (let i = 0; i < count && at + 46 <= b.length; i++) {
      if (v.getUint32(at, true) !== 0x02014b50) return false
      if (v.getUint16(at + 8, true) & 1) return true
      at += 46 + v.getUint16(at + 28, true) + v.getUint16(at + 30, true) + v.getUint16(at + 32, true)
    }
    return false
  }
  return false
}

function unzip(bytes: Uint8Array, what: string): Record<string, Uint8Array> {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new BrushFileError(`This ${what} file can't be opened: it is not a plain zip file.`)
  if (zipIsEncrypted(bytes)) throw new BrushFileError(`This ${what} file is locked (encrypted), so it can't be imported.`)
  let total = 0
  try {
    return unzipSync(bytes, {
      filter: (f) => {
        total += f.originalSize
        if (total > MAX_UNPACKED) throw new Error('too large')
        return !f.name.endsWith('/') && !f.name.startsWith('__MACOSX/')
      },
    })
  } catch (e) {
    throw new BrushFileError((e as Error).message === 'too large' ? `This ${what} file is too large.` : `This ${what} file can't be opened: it is not a plain zip file.`)
  }
}

// ---- Our own format ------------------------------------------------------------------

/** One file with one or more sets; a single brush is a set of one. */
export function exportBrushes(sets: { name: string; icon?: string; brushes: BrushDef[] }[]): Uint8Array {
  const json = JSON.stringify({ format: FORMAT, version: 1, sets: sets.map((s) => ({ name: s.name, icon: s.icon, brushes: s.brushes.map((b) => ({ ...b, builtIn: undefined })) })) })
  return zipSync({ 'brushes.json': new TextEncoder().encode(json) }, { level: 6 })
}

function importOwn(bytes: Uint8Array): ImportedSet[] {
  const files = unzip(bytes, '.egdbrush')
  const json = files['brushes.json']
  if (!json) throw new BrushFileError('This .egdbrush file has no brushes in it.')
  const data = JSON.parse(new TextDecoder().decode(json)) as { format?: string; sets?: { name?: string; icon?: string; brushes?: Partial<BrushDef>[] }[] }
  if (data.format !== FORMAT || !Array.isArray(data.sets)) throw new BrushFileError('This .egdbrush file is not a brush file.')
  return data.sets.map((s) => ({
    name: typeof s.name === 'string' ? s.name : 'Imported brushes',
    icon: typeof s.icon === 'string' ? s.icon : undefined,
    // New ids, so importing twice never clashes with brushes already here.
    brushes: (s.brushes ?? []).map((b) => normalizeBrush({ ...b, id: newId(), name: typeof b.name === 'string' ? b.name : 'Brush', builtIn: false })),
    unmapped: [],
  }))
}

// ---- .abr ------------------------------------------------------------------------

function importAbr(fileName: string, bytes: Uint8Array): ImportedSet[] {
  const tips = parseAbr(bytes)
  if (!tips.length) throw new BrushFileError('This .abr file has no image brushes in it (only those can be imported).')
  const base = fileName.replace(/\.abr$/i, '')
  const brushes = tips.map((t, i) =>
    normalizeBrush({
      ...normalizeSettings({ shapeImage: grayDataUrl(t), rotation: 0, spacing: t.spacing ?? 0.15, size: Math.min(300, Math.max(t.width, t.height)), hardness: 1, pressureSize: 0.5 }),
      id: newId(),
      name: t.name ?? `${base} ${i + 1}`,
      createdAt: Date.now(),
    }),
  )
  return [{ name: base, brushes, unmapped: [] }]
}

// ---- .brush / .brushset ------------------------------------------------------------

type Num = (v: number, out: Partial<BrushSettings>) => void

/**
 * Settings we understand in a .brush archive, by key (case-insensitive).
 * Values there are mostly 0..1; each entry turns one into our setting.
 */
const KEYS: Record<string, Num> = {
  plotspacing: (v, o) => (o.spacing = Math.max(0.02, v)),
  plotjitter: (v, o) => (o.scatter = v),
  plotsmoothing: (v, o) => (o.streamline = v),
  streamline: (v, o) => (o.streamline = v),
  stabilization: (v, o) => (o.stabilization = v),
  motionfiltering: (v, o) => (o.motionFilter = v),
  motionfilteringexpression: (v, o) => (o.motionExpression = v),
  dynamicsfalloff: (v, o) => (o.falloff = v),
  paintsize: (v, o) => (o.size = Math.max(1, v * 500)),
  paintopacity: (v, o) => (o.opacity = v),
  maxsize: (v, o) => (o.maxSize = Math.max(2, v <= 1 ? v * 500 : v)),
  minsize: (v, o) => (o.minSize = Math.max(0.5, v <= 1 ? v * 500 : v)),
  maxopacity: (v, o) => (o.maxOpacity = v),
  minopacity: (v, o) => (o.minOpacity = v),
  dynamicspressuresize: (v, o) => (o.pressureSize = v),
  dynamicspressureopacity: (v, o) => (o.pressureOpacity = v),
  dynamicsjittersize: (v, o) => (o.sizeJitter = v),
  dynamicsjitteropacity: (v, o) => (o.opacityJitter = v),
  dynamicsspeedsize: (v, o) => (o.speedSize = v),
  dynamicsspeedopacity: (v, o) => (o.speedOpacity = v),
  dynamicsglazedflow: (v, o) => (o.flow = Math.max(0.01, v)),
  renderingflow: (v, o) => (o.flow = Math.max(0.01, v)),
  dynamicswetedges: (v, o) => (o.wetEdges = v),
  dynamicsburntedges: (v, o) => (o.burntEdges = v),
  renderingalphathreshold: (v, o) => (o.alphaThreshold = v),
  taperstartlength: (v, o) => (o.taperStart = v * 400),
  taperendlength: (v, o) => (o.taperEnd = v * 400),
  pencilstartlength: (v, o) => (o.taperStart = v * 400),
  pencilendlength: (v, o) => (o.taperEnd = v * 400),
  touchstartlength: (v, o) => (o.touchTaperStart = v * 400),
  touchendlength: (v, o) => (o.touchTaperEnd = v * 400),
  tapersize: (v, o) => (o.taperSize = v),
  taperopacity: (v, o) => (o.taperOpacity = v),
  taperpressure: (v, o) => (o.taperPressure = v),
  shapescatter: (v, o) => (o.rotationJitter = v),
  shaperotation: (v, o) => (o.rotation = Math.round(v * 360)),
  shapecount: (v, o) => (o.count = Math.max(1, Math.round(v))),
  shapecountjitter: (v, o) => (o.countJitter = v),
  shaperoundness: (v, o) => (o.roundness = Math.max(0.05, v)),
  shapepressureroundness: (v, o) => (o.pressureRoundness = v),
  shapetiltroundness: (v, o) => (o.tiltRoundness = v),
  texturescale: (v, o) => (o.grainScale = Math.min(5, Math.max(0.1, v <= 1 ? 0.25 + v * 2 : v))),
  texturezoom: (v, o) => (o.grainZoom = v),
  texturedepth: (v, o) => (o.grainDepth = v),
  texturemovement: (v, o) => (o.grainMovement = v),
  texturerotation: (v, o) => (o.grainRotation = v * 360),
  texturecontrast: (v, o) => (o.grainContrast = v * 2 - 1),
  texturebrightness: (v, o) => (o.grainBrightness = v * 2 - 1),
  dilution: (v, o) => (o.dilution = v),
  wetmixdilution: (v, o) => (o.dilution = v),
  charge: (v, o) => (o.charge = v),
  wetmixcharge: (v, o) => (o.charge = v),
  attack: (v, o) => (o.attack = v),
  wetmixattack: (v, o) => (o.attack = v),
  pull: (v, o) => (o.pull = v),
  wetmixpull: (v, o) => (o.pull = v),
  grade: (v, o) => (o.grade = v),
  wetmixgrade: (v, o) => (o.grade = v),
  blur: (v, o) => (o.wetBlur = v),
  wetmixblur: (v, o) => (o.wetBlur = v),
  huejitter: (v, o) => (o.hueJitter = v),
  saturationjitter: (v, o) => (o.satJitter = v),
  brightnessjitter: (v, o) => (o.brightJitter = v),
  tiltangle: (v, o) => (o.tiltAngle = v <= 1 ? v * 90 : v),
  tiltsize: (v, o) => (o.tiltSize = v),
  tiltopacity: (v, o) => (o.tiltOpacity = v),
}

const BOOL_KEYS: Record<string, (v: boolean, o: Partial<BrushSettings>) => void> = {
  shaperandomise: (v, o) => (o.randomize = v),
  shaperandomize: (v, o) => (o.randomize = v),
  shapeflipx: (v, o) => (o.flipX = v),
  shapeflipxenabled: (v, o) => (o.flipX = v),
  shapeflipy: (v, o) => (o.flipY = v),
  shapeflipyenabled: (v, o) => (o.flipY = v),
  shapeazimuth: (v, o) => (o.azimuth = v),
  shapeinverted: (v, o) => (o.shapeInvert = v),
  textureinverted: (v, o) => (o.grainInvert = v),
  texturemoving: (v, o) => (o.grainMode = v ? 'moving' : 'texturized'),
  taperanimation: (v, o) => (o.tipAnimation = v),
  luminanceblending: (v, o) => (o.luminanceBlend = v),
  dynamicsluminanceblending: (v, o) => (o.luminanceBlend = v),
}

/** Bookkeeping in the archive that is not a brush setting. */
const IGNORED = new Set(['name', 'version', 'creationdate', 'uuid', 'identifier', 'author', 'authorname', 'signature', 'signatureimage'])

/** Our settings from the properties of a .brush archive, and the keys we could not use. */
export function mapBrushArchive(root: { [k: string]: PlistValue }): { settings: Partial<BrushSettings>; name: string | null; author: string | null; unmapped: string[] } {
  const settings: Partial<BrushSettings> = {}
  const unmapped: string[] = []
  for (const [key, value] of Object.entries(root)) {
    const k = key.toLowerCase()
    if (IGNORED.has(k) || value === null || value === '') continue
    if (typeof value === 'number' && KEYS[k] && Number.isFinite(value)) KEYS[k](value, settings)
    else if (typeof value === 'boolean' && BOOL_KEYS[k]) BOOL_KEYS[k](value, settings)
    else if (typeof value === 'number' && BOOL_KEYS[k]) BOOL_KEYS[k](value !== 0, settings)
    else unmapped.push(key)
  }
  const str = (k: string) => {
    const v = Object.entries(root).find(([key]) => key.toLowerCase() === k)?.[1]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  return { settings, name: str('name'), author: str('authorname') ?? str('author'), unmapped: unmapped.sort() }
}

/** One brush from the files of a .brush folder (archive, Shape.png, Grain.png). */
function brushFromFolder(files: Record<string, Uint8Array>, prefix: string, fallbackName: string): { brush: BrushDef; unmapped: string[] } | null {
  const get = (n: string) => Object.entries(files).find(([k]) => k.toLowerCase() === (prefix + n).toLowerCase())?.[1]
  const archive = get('Brush.archive')
  if (!archive) return null
  let root: PlistValue
  try {
    root = unarchive(parsePlist(archive))
  } catch {
    throw new BrushFileError('A brush in this file could not be read (its settings are not a plain property list).')
  }
  const props = root && typeof root === 'object' && !Array.isArray(root) && !(root instanceof Uint8Array) && !(root instanceof Date) ? (root as { [k: string]: PlistValue }) : {}
  const { settings, name, author, unmapped } = mapBrushArchive(props)
  const shape = get('Shape.png')
  const grain = get('Grain.png')
  if (shape) settings.shapeImage = pngDataUrl(shape)
  if (grain) {
    settings.grainImage = pngDataUrl(grain)
    settings.grainDepth ??= 0.8
  }
  const brush = normalizeBrush({ ...normalizeSettings(settings), id: newId(), name: name ?? fallbackName, createdAt: Date.now(), ...(author ? { author } : {}) })
  return { brush, unmapped }
}

function importBrushZip(fileName: string, bytes: Uint8Array, set: boolean): ImportedSet[] {
  const ext = set ? '.brushset' : '.brush'
  const files = unzip(bytes, ext)
  const base = fileName.replace(/\.(brush|brushset)$/i, '')
  // Folders that hold a Brush.archive; "" is the top of the zip.
  const folders = [...new Set(Object.keys(files).filter((k) => /(^|\/)brush\.archive$/i.test(k)).map((k) => k.slice(0, k.length - 'Brush.archive'.length)))]
  if (!folders.length) throw new BrushFileError(`This ${ext} file has no brushes in it.`)
  let name = base
  const meta = Object.entries(files).find(([k]) => /(^|\/)brushset\.plist$/i.test(k))?.[1]
  if (meta) {
    try {
      const m = unarchive(parsePlist(meta)) as { name?: PlistValue; brushes?: PlistValue }
      if (typeof m?.name === 'string' && m.name.trim()) name = m.name.trim()
      // Keep the order the set lists.
      if (Array.isArray(m?.brushes)) {
        const order = m.brushes.map(String)
        folders.sort((a, b) => {
          const ia = order.indexOf(a.replace(/\/$/, ''))
          const ib = order.indexOf(b.replace(/\/$/, ''))
          return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib)
        })
      }
    } catch {
      // The set's name and order are nice to have; the brushes matter.
    }
  }
  const brushes: BrushDef[] = []
  const unmapped: ImportedSet['unmapped'] = []
  folders.forEach((f, i) => {
    const got = brushFromFolder(files, f, folders.length > 1 ? `${base} ${i + 1}` : base)
    if (!got) return
    brushes.push(got.brush)
    if (got.unmapped.length) unmapped.push({ brush: got.brush.name, keys: got.unmapped })
  })
  return [{ name, brushes, unmapped }]
}

/** Read a brush file of any supported kind into sets of new brushes. Throws BrushFileError with a friendly message. */
export function importBrushFile(fileName: string, bytes: Uint8Array): ImportedSet[] {
  const ext = fileName.split('.').pop()?.toLowerCase()
  try {
    if (ext === 'egdbrush') return importOwn(bytes)
    if (ext === 'abr') return importAbr(fileName, bytes)
    if (ext === 'brush') return importBrushZip(fileName, bytes, false)
    if (ext === 'brushset') return importBrushZip(fileName, bytes, true)
  } catch (e) {
    if (e instanceof BrushFileError) throw e
    throw new BrushFileError(`${fileName} could not be read: ${(e as Error).message}`)
  }
  throw new BrushFileError(`${fileName} is not a brush file. Brush files end in ${BRUSH_EXTENSIONS.map((x) => '.' + x).join(', ')}.`)
}
