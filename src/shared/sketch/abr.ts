/**
 * Photoshop brush (.abr) reader: the sampled brush tips (grayscale images)
 * of versions 1, 2, 6 and 10. Computed (round) tips and brush settings are
 * skipped; each tip becomes a custom brush shape.
 */

export interface AbrTip {
  width: number
  height: number
  /** One byte per pixel, 255 = paint. */
  gray: Uint8Array
  /** 0..1 when the file says (v1/v2), else null. */
  spacing: number | null
  name: string | null
}

class Reader {
  pos = 0
  readonly v: DataView
  readonly b: Uint8Array
  constructor(b: Uint8Array) {
    this.b = b
    this.v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  }
  need(n: number) {
    if (this.pos + n > this.b.length) throw new Error('This .abr file ends too early.')
  }
  u8() {
    this.need(1)
    return this.b[this.pos++]
  }
  u16() {
    this.need(2)
    const v = this.v.getUint16(this.pos)
    this.pos += 2
    return v
  }
  i16() {
    this.need(2)
    const v = this.v.getInt16(this.pos)
    this.pos += 2
    return v
  }
  u32() {
    this.need(4)
    const v = this.v.getUint32(this.pos)
    this.pos += 4
    return v
  }
  i32() {
    this.need(4)
    const v = this.v.getInt32(this.pos)
    this.pos += 4
    return v
  }
  str(n: number) {
    this.need(n)
    const s = String.fromCharCode(...this.b.subarray(this.pos, this.pos + n))
    this.pos += n
    return s
  }
}

/** PackBits rows: per row a byte count, then runs. */
function unpackBits(r: Reader, rowBytes: number, height: number): Uint8Array {
  const counts: number[] = []
  for (let y = 0; y < height; y++) counts.push(r.u16())
  const out = new Uint8Array(rowBytes * height)
  let o = 0
  for (let y = 0; y < height; y++) {
    const end = r.pos + counts[y]
    const rowEnd = (y + 1) * rowBytes
    while (r.pos < end) {
      let n = r.u8()
      if (n >= 128) n -= 256
      if (n === -128) continue
      if (n < 0) {
        const v = r.u8()
        for (let c = 0; c < 1 - n && o < rowEnd; c++) out[o++] = v
      } else {
        for (let c = 0; c < n + 1; c++) {
          const v = r.u8()
          if (o < rowEnd) out[o++] = v
        }
      }
    }
    r.pos = end
    o = rowEnd
  }
  return out
}

/** Pixels of one tip: raw or PackBits, 8 or 16 bits deep (16 bits keep the high byte). */
function readPixels(r: Reader, width: number, height: number, depth: number, compressed: boolean): Uint8Array {
  if (width <= 0 || height <= 0 || width > 10000 || height > 10000) throw new Error('A brush in this .abr file has an odd size.')
  const bpp = depth === 16 ? 2 : 1
  let data: Uint8Array
  if (compressed) data = unpackBits(r, width * bpp, height)
  else {
    r.need(width * height * bpp)
    data = r.b.slice(r.pos, r.pos + width * height * bpp)
    r.pos += width * height * bpp
  }
  if (bpp === 1) return data
  const out = new Uint8Array(width * height)
  for (let i = 0; i < out.length; i++) out[i] = data[i * 2]
  return out
}

function readV12(r: Reader, version: number): AbrTip[] {
  const count = r.u16()
  const tips: AbrTip[] = []
  for (let i = 0; i < count; i++) {
    const type = r.u16()
    const size = r.u32()
    const next = r.pos + size
    if (type === 2) {
      r.u32() // misc
      const spacing = r.u16() / 100
      let name: string | null = null
      if (version === 2) {
        const n = r.u32()
        let s = ''
        for (let k = 0; k < n; k++) s += String.fromCharCode(r.u16())
        name = s.replace(/\0+$/, '') || null
      }
      r.u8() // antialias
      r.pos += 8 // short bounds
      const top = r.i32()
      const left = r.i32()
      const bottom = r.i32()
      const right = r.i32()
      const depth = r.u16()
      const compressed = r.u8() === 1
      const width = right - left
      const height = bottom - top
      tips.push({ width, height, gray: readPixels(r, width, height, depth, compressed), spacing, name })
    }
    r.pos = next
  }
  return tips
}

function readV6(r: Reader, subversion: number): AbrTip[] {
  // Find the "samp" section among the 8BIM sections.
  for (;;) {
    if (r.pos + 12 > r.b.length) return []
    if (r.str(4) !== '8BIM') throw new Error('This .abr file has an unknown layout.')
    const key = r.str(4)
    const size = r.u32()
    if (key === 'samp') {
      const end = r.pos + size
      const tips: AbrTip[] = []
      while (r.pos < end - 4) {
        const len = r.u32()
        const next = r.pos + len + ((4 - (len % 4)) % 4)
        // Brush id (37 bytes) and other data before the bounds.
        r.pos += subversion === 1 ? 47 : 301
        const top = r.i32()
        const left = r.i32()
        const bottom = r.i32()
        const right = r.i32()
        const depth = r.u16()
        const compressed = r.u8() === 1
        const width = right - left
        const height = bottom - top
        tips.push({ width, height, gray: readPixels(r, width, height, depth, compressed), spacing: null, name: null })
        r.pos = next
      }
      return tips
    }
    r.pos += size
  }
}

/** All sampled tips in an .abr file. Throws a friendly error for files it can't read. */
export function parseAbr(bytes: Uint8Array): AbrTip[] {
  const r = new Reader(bytes)
  const version = r.u16()
  if (version === 1 || version === 2) return readV12(r, version)
  if (version === 6 || version === 7 || version === 10) {
    const sub = r.u16()
    return readV6(r, sub)
  }
  throw new Error(`This .abr file is version ${version}, which can't be read.`)
}
