import { unzlibSync } from 'fflate'
import type { BlendMode } from '../blend'
import { layerTree, type LayerNode } from '../layers'
import type { SketchLayer } from '../model'
import { ByteReader, ByteWriter, packBits, unpackBits } from './bytes'

/**
 * Photoshop files, hand-written (Sketch Pro): reads and writes 8-bit RGB PSDs
 * with layers, names, opacity, blend modes, visibility, clipping, groups and
 * layer masks. Pixel data can be raw, RLE (PackBits) or zip.
 */

/** RGBA pixels, like ImageData (plain object so tests run without a DOM). */
export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** Our blend ids and the four-letter keys Photoshop uses. */
const BLEND_KEYS: Record<BlendMode, string> = {
  'source-over': 'norm',
  darken: 'dark',
  multiply: 'mul ',
  'color-burn': 'idiv',
  'linear-burn': 'lbrn',
  'darker-color': 'dkCl',
  lighten: 'lite',
  screen: 'scrn',
  'color-dodge': 'div ',
  lighter: 'lddg',
  'lighter-color': 'lgCl',
  overlay: 'over',
  'soft-light': 'sLit',
  'hard-light': 'hLit',
  'vivid-light': 'vLit',
  'linear-light': 'lLit',
  'pin-light': 'pLit',
  'hard-mix': 'hMix',
  difference: 'diff',
  exclusion: 'smud',
  subtract: 'fsub',
  divide: 'fdiv',
  hue: 'hue ',
  saturation: 'sat ',
  color: 'colr',
  luminosity: 'lum ',
}
const FROM_KEY = new Map(Object.entries(BLEND_KEYS).map(([id, key]) => [key, id as BlendMode]))
/** Photoshop key -> our blend id; pass-through and dissolve become Normal. */
export const blendFromKey = (key: string): BlendMode => FROM_KEY.get(key) ?? 'source-over'
export const blendToKey = (id: BlendMode): string => BLEND_KEYS[id] ?? 'norm'

export class PsdError extends Error {}

// ---- Reading ------------------------------------------------------------------

export interface PsdLayer {
  /** Only unique inside this file. */
  id: string
  name: string
  /** 0..1 */
  opacity: number
  blend: BlendMode
  visible: boolean
  clip: boolean
  kind?: 'group' | 'mask'
  collapsed?: boolean
  parent: string | null
  /** Pixels and where they sit on the canvas; null for groups and empty layers. */
  pixels: (Pixels & { left: number; top: number }) | null
}

export interface PsdFile {
  width: number
  height: number
  /** Bottom to top, children before their group, a mask right after its layer (like SketchDoc.layers). */
  layers: PsdLayer[]
}

interface Channel {
  id: number
  length: number
}

/** One channel's pixels (w*h bytes) from its compressed data. */
function readChannel(r: ByteReader, w: number, h: number, length: number): Uint8Array {
  const end = r.pos + length
  const out = new Uint8Array(w * h)
  if (length < 2) return out
  const comp = r.u16()
  if (w && h) {
    if (comp === 0) out.set(r.bytes(Math.min(w * h, end - r.pos)))
    else if (comp === 1) {
      const counts = Array.from({ length: h }, () => r.u16())
      for (let y = 0; y < h; y++) unpackBits(r.bytes(counts[y]), out.subarray(y * w, (y + 1) * w))
    } else if (comp === 2 || comp === 3) {
      const raw = unzlibSync(r.bytes(end - r.pos))
      out.set(raw.subarray(0, out.length))
      // Prediction: every byte is stored as the difference to the one on its left.
      if (comp === 3) for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) out[y * w + x] = (out[y * w + x] + out[y * w + x - 1]) & 255
    } else throw new PsdError('This PSD uses a compression we cannot read')
  }
  r.pos = end
  return out
}

export function readPsd(bytes: Uint8Array): PsdFile {
  const r = new ByteReader(bytes)
  if (r.ascii(4) !== '8BPS') throw new PsdError('This is not a Photoshop file')
  const version = r.u16()
  if (version !== 1) throw new PsdError('Large documents (PSB) are not supported; save as PSD')
  r.skip(6)
  const channels = r.u16()
  const height = r.u32()
  const width = r.u32()
  const depth = r.u16()
  const mode = r.u16()
  if (depth !== 8 || mode !== 3) throw new PsdError('Only 8-bit RGB Photoshop files can be opened; convert it to 8 bits per channel, RGB colour')
  r.skip(r.u32()) // colour mode data
  r.skip(r.u32()) // image resources
  const lmLength = r.u32()
  const lmEnd = r.pos + lmLength
  const layers: PsdLayer[] = []
  if (lmLength) {
    const liLength = r.u32()
    if (liLength) {
      const count = Math.abs(r.i16())
      const recs = []
      for (let i = 0; i < count; i++) {
        const top = r.i32()
        const left = r.i32()
        const bottom = r.i32()
        const right = r.i32()
        const chans: Channel[] = Array.from({ length: r.u16() }, () => ({ id: r.i16(), length: r.u32() }))
        if (r.ascii(4) !== '8BIM') throw new PsdError('The layer list is damaged')
        const key = r.ascii(4)
        const opacity = r.u8() / 255
        const clipping = r.u8()
        const flags = r.u8()
        r.skip(1)
        const extraEnd = r.u32() + r.pos
        let mask: { top: number; left: number; bottom: number; right: number; color: number; off: boolean } | null = null
        const maskLen = r.u32()
        const maskEnd = r.pos + maskLen
        if (maskLen >= 18) mask = { top: r.i32(), left: r.i32(), bottom: r.i32(), right: r.i32(), color: r.u8(), off: !!(r.u8() & 2) }
        r.pos = maskEnd
        r.skip(r.u32()) // blending ranges
        const nameLen = r.u8()
        let name = new TextDecoder('latin1').decode(r.bytes(nameLen))
        r.skip((4 - ((nameLen + 1) % 4)) % 4)
        let section = 0
        while (r.pos + 12 <= extraEnd) {
          const sig = r.ascii(4)
          if (sig !== '8BIM' && sig !== '8B64') break
          const k = r.ascii(4)
          const len = r.u32()
          const end = r.pos + len
          if (k === 'luni') {
            const n = r.u32()
            name = String.fromCharCode(...Array.from({ length: n }, () => r.u16())).replace(/\0+$/, '')
          } else if (k === 'lsct' || k === 'lsdk') section = r.u32()
          r.pos = end + (len % 2)
        }
        r.pos = extraEnd
        recs.push({ top, left, bottom, right, chans, key, opacity, clipping, flags, mask, name, section })
      }
      // Pixels follow, in the same order.
      const open: string[] = []
      recs.forEach((rec, i) => {
        const w = Math.max(0, rec.right - rec.left)
        const h = Math.max(0, rec.bottom - rec.top)
        const data: Record<number, Uint8Array> = {}
        for (const c of rec.chans) {
          const m = rec.mask
          data[c.id] = c.id === -2 && m ? readChannel(r, m.right - m.left, m.bottom - m.top, c.length) : c.id < -1 ? (r.skip(c.length), new Uint8Array()) : readChannel(r, w, h, c.length)
        }
        const parent = open[open.length - 1] ?? null
        const base = { opacity: rec.opacity, blend: blendFromKey(rec.key), visible: !(rec.flags & 2), clip: rec.clipping === 1, name: rec.name }
        // Groups: a hidden "bounding divider" comes first, then the contents, then the group itself.
        if (rec.section === 3) {
          open.push(`g${i}`)
          return
        }
        let id = `l${i}`
        let entry: PsdLayer
        if (rec.section === 1 || rec.section === 2) {
          id = open.pop() ?? id
          entry = { ...base, id, kind: 'group', collapsed: rec.section === 2, parent: open[open.length - 1] ?? null, pixels: null }
        } else {
          let pixels: PsdLayer['pixels'] = null
          if (w && h) {
            const px = new Uint8ClampedArray(w * h * 4)
            const alpha = data[-1]
            for (let p = 0; p < w * h; p++) {
              px[p * 4] = data[0]?.[p] ?? 0
              px[p * 4 + 1] = data[1]?.[p] ?? 0
              px[p * 4 + 2] = data[2]?.[p] ?? 0
              px[p * 4 + 3] = alpha ? alpha[p] : 255
            }
            pixels = { left: rec.left, top: rec.top, width: w, height: h, data: px }
          }
          entry = { ...base, id, parent, pixels }
        }
        layers.push(entry)
        const m = rec.mask
        if (m && !m.off && data[-2]) {
          // Our masks hide where dark, over the whole canvas; outside its box a PSD mask has one colour.
          const px = new Uint8ClampedArray(width * height * 4).fill(255)
          const mw = m.right - m.left
          for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
              const inside = x >= m.left && x < m.right && y >= m.top && y < m.bottom
              const g = inside ? data[-2][(y - m.top) * mw + (x - m.left)] : m.color
              const o = (y * width + x) * 4
              px[o] = px[o + 1] = px[o + 2] = g
            }
          layers.push({ id: `${id}m`, name: 'Mask', opacity: 1, blend: 'source-over', visible: true, clip: false, kind: 'mask', parent: entry.parent, pixels: { left: 0, top: 0, width, height, data: px } })
        }
      })
    }
  }
  r.pos = lmEnd
  if (!layers.some((l) => l.kind !== 'group')) {
    // No layers: the flattened picture becomes one layer.
    const comp = r.u16()
    const planes: Uint8Array[] = []
    if (comp === 1) {
      const counts = Array.from({ length: channels * height }, () => r.u16())
      for (let c = 0; c < channels; c++) {
        const plane = new Uint8Array(width * height)
        for (let y = 0; y < height; y++) unpackBits(r.bytes(counts[c * height + y]), plane.subarray(y * width, (y + 1) * width))
        planes.push(plane)
      }
    } else if (comp === 0) for (let c = 0; c < channels; c++) planes.push(r.bytes(width * height))
    else throw new PsdError('This PSD uses a compression we cannot read')
    const px = new Uint8ClampedArray(width * height * 4)
    for (let p = 0; p < width * height; p++) {
      px[p * 4] = planes[0][p]
      px[p * 4 + 1] = planes[1]?.[p] ?? planes[0][p]
      px[p * 4 + 2] = planes[2]?.[p] ?? planes[0][p]
      px[p * 4 + 3] = channels >= 4 ? planes[3][p] : 255
    }
    return { width, height, layers: [{ id: 'bg', name: 'Background', opacity: 1, blend: 'source-over', visible: true, clip: false, parent: null, pixels: { left: 0, top: 0, width, height, data: px } }] }
  }
  return { width, height, layers }
}

// ---- Writing ------------------------------------------------------------------

/** One channel, compressed with RLE when that is smaller. */
function encodeChannel(plane: Uint8Array, w: number, h: number): Uint8Array {
  const out = new ByteWriter()
  if (!w || !h) return out.u16(0).done()
  const rows = Array.from({ length: h }, (_, y) => packBits(plane.subarray(y * w, (y + 1) * w)))
  const rle = rows.reduce((s, row) => s + row.length, 0) + 2 * h
  if (rle >= w * h) return out.u16(0).bytes(plane).done()
  out.u16(1)
  for (const row of rows) out.u16(row.length)
  for (const row of rows) out.bytes(row)
  return out.done()
}

/** Bounding box of the non-transparent pixels, or null when empty. */
export function opaqueBounds(p: Pixels): { left: number; top: number; right: number; bottom: number } | null {
  let left = p.width
  let top = p.height
  let right = 0
  let bottom = 0
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++)
      if (p.data[(y * p.width + x) * 4 + 3]) {
        if (x < left) left = x
        if (x >= right) right = x + 1
        if (y < top) top = y
        bottom = y + 1
      }
  return right > left ? { left, top, right, bottom } : null
}

interface Record_ {
  name: string
  rect: { top: number; left: number; bottom: number; right: number }
  channels: { id: number; data: Uint8Array }[]
  key: string
  opacity: number
  clip: boolean
  hidden: boolean
  section?: 1 | 2 | 3
  mask?: { top: number; left: number; bottom: number; right: number }
}

export interface PsdSource {
  width: number
  height: number
  /** Without private layers. */
  layers: SketchLayer[]
  /** A layer's (or mask's) pixels at canvas size, or null when empty. */
  pixels(id: string): Pixels | null
  /** The flattened picture with background. */
  composite: Pixels
}

export function writePsd(src: PsdSource): Uint8Array {
  const { width, height } = src
  const recs: Record_[] = []
  const zero = { top: 0, left: 0, bottom: 0, right: 0 }

  /** A visible mask as a PSD user mask over the whole canvas; ours hide where dark or empty (grey = brightness x alpha). */
  const maskOf = (m: SketchLayer | undefined): Pick<Record_, 'mask'> & { ch: Record_['channels'] } => {
    if (!m?.visible) return { ch: [] }
    const px = src.pixels(m.id)
    const plane = new Uint8Array(width * height)
    if (px)
      for (let p = 0; p < plane.length; p++) {
        const d = px.data
        plane[p] = Math.round(((0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]) * d[p * 4 + 3]) / 255)
      }
    return { mask: { top: 0, left: 0, bottom: height, right: width }, ch: [{ id: -2, data: encodeChannel(plane, width, height) }] }
  }

  const walk = (nodes: LayerNode[]) => {
    for (const { layer, children, mask } of nodes) {
      const common = { name: layer.name, key: blendToKey(layer.blend), opacity: layer.opacity, clip: layer.clip, hidden: !layer.visible }
      const m = maskOf(mask)
      if (children) {
        const empty = [-1, 0, 1, 2].map((id) => ({ id, data: encodeChannel(new Uint8Array(), 0, 0) }))
        recs.push({ ...common, name: '</Layer group>', key: 'norm', opacity: 1, clip: false, hidden: false, rect: zero, channels: empty, section: 3 })
        walk(children)
        recs.push({ ...common, rect: zero, channels: [...empty, ...m.ch], section: layer.collapsed ? 2 : 1, mask: m.mask })
        continue
      }
      const px = src.pixels(layer.id)
      const b = px && opaqueBounds(px)
      const rect = b ?? zero
      const w = rect.right - rect.left
      const h = rect.bottom - rect.top
      const planes = [3, 0, 1, 2].map((c) => {
        const plane = new Uint8Array(w * h)
        if (px) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) plane[y * w + x] = px.data[((y + rect.top) * width + x + rect.left) * 4 + c]
        return plane
      })
      recs.push({ ...common, rect, channels: [-1, 0, 1, 2].map((id, i) => ({ id, data: encodeChannel(planes[i], w, h) })).concat(m.ch), mask: m.mask })
    }
  }
  walk(layerTree(src.layers))

  const out = new ByteWriter()
  out.ascii('8BPS').u16(1).bytes([0, 0, 0, 0, 0, 0]).u16(3).u32(height).u32(width).u16(8).u16(3)
  out.u32(0) // colour mode data
  out.u32(0) // image resources
  const lmAt = out.length
  out.u32(0)
  const liAt = out.length
  out.u32(0)
  out.i16(recs.length)
  for (const rec of recs) {
    out.i32(rec.rect.top).i32(rec.rect.left).i32(rec.rect.bottom).i32(rec.rect.right)
    out.u16(rec.channels.length)
    for (const c of rec.channels) out.i16(c.id).u32(c.data.length)
    out.ascii('8BIM').ascii(rec.key).u8(Math.round(rec.opacity * 255)).u8(rec.clip ? 1 : 0)
    out.u8((rec.hidden ? 2 : 0) | 8 | (rec.section ? 16 : 0)).u8(0)
    const extra = new ByteWriter()
    if (rec.mask) extra.u32(20).i32(rec.mask.top).i32(rec.mask.left).i32(rec.mask.bottom).i32(rec.mask.right).u8(0).u8(0).u16(0)
    else extra.u32(0)
    extra.u32(0) // blending ranges
    const ascii = rec.name.replace(/[^\x20-\x7e]/g, '?').slice(0, 255)
    extra.u8(ascii.length).ascii(ascii)
    const nameBytes = ascii.length + 1
    for (let i = nameBytes; i % 4; i++) extra.u8(0)
    // Full (unicode) name.
    const uni = new ByteWriter().u32(rec.name.length)
    for (let i = 0; i < rec.name.length; i++) uni.u16(rec.name.charCodeAt(i))
    if (uni.length % 4) uni.u16(0)
    extra.ascii('8BIMluni').u32(uni.length).bytes(uni.done())
    if (rec.section) extra.ascii('8BIMlsct').u32(4).u32(rec.section)
    out.u32(extra.length).bytes(extra.done())
  }
  for (const rec of recs) for (const c of rec.channels) out.bytes(c.data)
  if ((out.length - liAt - 4) % 2) out.u8(0)
  out.setU32(liAt, out.length - liAt - 4)
  out.u32(0) // global layer mask
  out.setU32(lmAt, out.length - lmAt - 4)

  // The flattened picture, RLE, one plane per colour.
  const { composite } = src
  const n = width * height
  const rows: Uint8Array[] = []
  for (let c = 0; c < 3; c++) {
    const plane = new Uint8Array(n)
    for (let p = 0; p < n; p++) plane[p] = composite.data[p * 4 + c]
    for (let y = 0; y < height; y++) rows.push(packBits(plane.subarray(y * width, (y + 1) * width)))
  }
  out.u16(1)
  for (const row of rows) out.u16(row.length)
  for (const row of rows) out.bytes(row)
  return out.done()
}
