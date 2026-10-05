import { ByteWriter } from './bytes'
import type { Pixels } from './psd'

/**
 * Animated GIF writer, hand-written (Sketch Pro): each frame gets its own
 * 255-colour palette (median cut) plus one transparent entry, LZW compressed.
 */

export interface GifFrame {
  pixels: Pixels
  /** How long the frame shows, in ms (GIF keeps 1/100 s). */
  delay: number
}

/** Colours are counted at 5 bits per channel. */
const key = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)

/** Up to `max` colours that represent the opaque pixels well (median cut over a 5-bit histogram). */
export function palette(data: Uint8ClampedArray, max = 255): [number, number, number][] {
  const hist = new Uint32Array(32768)
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] >= 128) hist[key(data[i], data[i + 1], data[i + 2])]++
  const bins: number[] = []
  for (let k = 0; k < hist.length; k++) if (hist[k]) bins.push(k)
  if (!bins.length) return [[0, 0, 0]]
  const ch = (k: number, c: number) => (k >> (10 - c * 5)) & 31
  type Box = { bins: number[]; count: number; span: number; axis: number }
  const measure = (bs: number[]): Box => {
    let count = 0
    let best = { span: -1, axis: 0 }
    for (let c = 0; c < 3; c++) {
      let lo = 31
      let hi = 0
      for (const k of bs) {
        const v = ch(k, c)
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      if (hi - lo > best.span) best = { span: hi - lo, axis: c }
    }
    for (const k of bs) count += hist[k]
    return { bins: bs, count, ...best }
  }
  const boxes = [measure(bins)]
  while (boxes.length < max) {
    // Split the box with the most pixels times colour spread.
    let pick = -1
    for (let i = 0; i < boxes.length; i++) if (boxes[i].bins.length > 1 && (pick < 0 || boxes[i].count * boxes[i].span > boxes[pick].count * boxes[pick].span)) pick = i
    if (pick < 0) break
    const b = boxes[pick]
    const sorted = [...b.bins].sort((x, y) => ch(x, b.axis) - ch(y, b.axis))
    let acc = 0
    let cut = 1
    for (; cut < sorted.length - 1; cut++) if ((acc += hist[sorted[cut - 1]]) >= b.count / 2) break
    boxes.splice(pick, 1, measure(sorted.slice(0, cut)), measure(sorted.slice(cut)))
  }
  return boxes.map((b) => {
    const s = [0, 0, 0]
    for (const k of b.bins) for (let c = 0; c < 3; c++) s[c] += (ch(k, c) * 8 + 4) * hist[k]
    return s.map((v) => Math.round(v / b.count)) as [number, number, number]
  })
}

/** GIF LZW, packed into 255-byte sub-blocks. */
export function lzw(indices: Uint8Array, minCode: number): Uint8Array {
  const clear = 1 << minCode
  const eoi = clear + 1
  const out = new ByteWriter()
  let block: number[] = []
  let acc = 0
  let bits = 0
  let size = minCode + 1
  const emit = (code: number) => {
    acc |= code << bits
    bits += size
    while (bits >= 8) {
      block.push(acc & 255)
      acc >>>= 8
      bits -= 8
      if (block.length === 255) {
        out.u8(255).bytes(block)
        block = []
      }
    }
  }
  let dict = new Map<number, number>()
  let next = eoi + 1
  emit(clear)
  let prefix = indices.length ? indices[0] : -1
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const id = (prefix << 8) | k
    const hit = dict.get(id)
    if (hit !== undefined) {
      prefix = hit
      continue
    }
    emit(prefix)
    if (next < 4096) {
      dict.set(id, next++)
      if (next > 1 << size && size < 12) size++
    } else {
      emit(clear)
      dict = new Map()
      next = eoi + 1
      size = minCode + 1
    }
    prefix = k
  }
  if (prefix >= 0) emit(prefix)
  emit(eoi)
  if (bits > 0) block.push(acc & 255)
  if (block.length) out.u8(block.length).bytes(block)
  out.u8(0)
  return out.done()
}

export function encodeGif(frames: GifFrame[], loop = true): Uint8Array {
  const { width, height } = frames[0].pixels
  const out = new ByteWriter(true)
  out.ascii('GIF89a').u16(width).u16(height).u8(0).u8(0).u8(0)
  if (loop) out.u8(0x21).u8(0xff).u8(11).ascii('NETSCAPE2.0').u8(3).u8(1).u16(0).u8(0)
  for (const f of frames) {
    const { data } = f.pixels
    const pal = palette(data)
    // Index 0 is transparent; the palette follows.
    const cache = new Int16Array(32768).fill(-1)
    const idx = new Uint8Array(width * height)
    let transparent = false
    for (let p = 0; p < idx.length; p++) {
      const o = p * 4
      if (data[o + 3] < 128) {
        transparent = true
        continue
      }
      const k = key(data[o], data[o + 1], data[o + 2])
      let c = cache[k]
      if (c < 0) {
        let best = Infinity
        for (let i = 0; i < pal.length; i++) {
          const d = (pal[i][0] - data[o]) ** 2 + (pal[i][1] - data[o + 1]) ** 2 + (pal[i][2] - data[o + 2]) ** 2
          if (d < best) {
            best = d
            c = i + 1
          }
        }
        cache[k] = c
      }
      idx[p] = c
    }
    // Graphic control: delay, and clear to transparent before the next frame.
    out.u8(0x21).u8(0xf9).u8(4).u8((2 << 2) | (transparent ? 1 : 0)).u16(Math.max(2, Math.round(f.delay / 10))).u8(0).u8(0)
    out.u8(0x2c).u16(0).u16(0).u16(width).u16(height).u8(0x80 | 7) // local table of 256
    for (let i = 0; i < 256; i++) {
      const c = pal[i - 1] ?? [0, 0, 0]
      out.u8(c[0]).u8(c[1]).u8(c[2])
    }
    out.u8(8).bytes(lzw(idx, 8))
  }
  out.u8(0x3b)
  return out.done()
}
