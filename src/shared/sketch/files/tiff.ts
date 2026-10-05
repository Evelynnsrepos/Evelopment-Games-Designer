import { ByteReader, ByteWriter, unpackBits } from './bytes'
import type { Pixels } from './psd'

/**
 * TIFF, hand-written (Sketch Pro). The writer makes a plain uncompressed RGBA file
 * every program opens; the reader handles the simple kind (8 bits, uncompressed or
 * PackBits, grey / RGB with or without alpha) for webviews that can't decode TIFF.
 */

export function writeTiff(p: Pixels): Uint8Array {
  const { width, height } = p
  const tags: [tag: number, type: number, count: number, value: number][] = []
  const w = new ByteWriter(true)
  w.ascii('II').u16(42).u32(8)
  const entries = 13
  const ifdSize = 2 + entries * 12 + 4
  const extra = 8 + ifdSize // bits per sample, then two resolutions
  const pixelsAt = extra + 8 + 16
  // Tags in ascending order (SHORT = 3, LONG = 4, RATIONAL = 5).
  tags.push(
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, 4, extra],
    [259, 3, 1, 1],
    [262, 3, 1, 2],
    [273, 4, 1, pixelsAt],
    [277, 3, 1, 4],
    [278, 4, 1, height],
    [279, 4, 1, width * height * 4],
    [282, 5, 1, extra + 8],
    [283, 5, 1, extra + 16],
    [296, 3, 1, 2],
    [338, 3, 1, 2], // extra sample: alpha, not premultiplied
  )
  w.u16(entries)
  for (const [tag, type, count, value] of tags) {
    w.u16(tag).u16(type).u32(count)
    if (type === 3 && count === 1) w.u16(value).u16(0)
    else w.u32(value)
  }
  w.u32(0)
  w.u16(8).u16(8).u16(8).u16(8)
  w.u32(72).u32(1).u32(72).u32(1)
  w.bytes(p.data)
  return w.done()
}

export function readTiff(bytes: Uint8Array): Pixels {
  const order = String.fromCharCode(bytes[0], bytes[1])
  if (order !== 'II' && order !== 'MM') throw new Error('This is not a TIFF image')
  const r = new ByteReader(bytes, order === 'II')
  r.pos = 2
  if (r.u16() !== 42) throw new Error('This is not a TIFF image (or a BigTIFF, which is not supported)')
  r.pos = r.u32()
  const tags = new Map<number, number[]>()
  const n = r.u16()
  for (let i = 0; i < n; i++) {
    const tag = r.u16()
    const type = r.u16()
    const count = r.u32()
    const size = type === 3 ? 2 : type === 4 ? 4 : 1
    const at = r.pos
    if (count * size > 4) r.pos = r.u32()
    tags.set(tag, Array.from({ length: count }, () => (type === 3 ? r.u16() : type === 4 ? r.u32() : r.u8())))
    r.pos = at + 4
  }
  const one = (t: number, d: number) => tags.get(t)?.[0] ?? d
  const width = one(256, 0)
  const height = one(257, 0)
  const spp = one(277, 1)
  const comp = one(259, 1)
  const photo = one(262, 1)
  if ((tags.get(258) ?? [1]).some((b) => b !== 8)) throw new Error('Only 8-bit TIFF images can be opened here')
  if (comp !== 1 && comp !== 32773) throw new Error('This TIFF uses a compression we cannot read')
  if (one(284, 1) !== 1 || ![0, 1, 2].includes(photo)) throw new Error('This kind of TIFF cannot be opened here')
  const raw = new Uint8Array(width * height * spp)
  const offsets = tags.get(273) ?? []
  const counts = tags.get(279) ?? []
  const rowsPer = one(278, height)
  offsets.forEach((off, i) => {
    const start = i * rowsPer * width * spp
    const part = raw.subarray(start, Math.min(raw.length, start + rowsPer * width * spp))
    const src = bytes.subarray(off, off + counts[i])
    if (comp === 1) part.set(src.subarray(0, part.length))
    else unpackBits(src, part)
  })
  const data = new Uint8ClampedArray(width * height * 4)
  const color = photo === 2
  const alpha = spp > (color ? 3 : 1)
  for (let p = 0; p < width * height; p++) {
    const s = p * spp
    let [r0, g0, b0] = color ? [raw[s], raw[s + 1], raw[s + 2]] : [raw[s], raw[s], raw[s]]
    if (photo === 0) [r0, g0, b0] = [255 - r0, 255 - g0, 255 - b0]
    data.set([r0, g0, b0, alpha ? raw[s + spp - 1] : 255], p * 4)
  }
  return { width, height, data }
}
