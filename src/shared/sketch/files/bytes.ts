/**
 * Small byte helpers for the hand-written file formats (PSD, TIFF, GIF, APNG, WebM).
 */

/** A growing byte buffer; numbers are big-endian unless `le` is set. */
export class ByteWriter {
  private buf = new Uint8Array(1024)
  length = 0
  constructor(private le = false) {}

  private room(n: number) {
    if (this.length + n <= this.buf.length) return
    let size = this.buf.length * 2
    while (size < this.length + n) size *= 2
    const next = new Uint8Array(size)
    next.set(this.buf.subarray(0, this.length))
    this.buf = next
  }
  u8(v: number) {
    this.room(1)
    this.buf[this.length++] = v & 255
    return this
  }
  u16(v: number) {
    return this.le ? this.u8(v).u8(v >> 8) : this.u8(v >> 8).u8(v)
  }
  u32(v: number) {
    return this.le ? this.u16(v & 0xffff).u16(v >>> 16) : this.u16(v >>> 16).u16(v & 0xffff)
  }
  i16(v: number) {
    return this.u16(v < 0 ? v + 0x10000 : v)
  }
  i32(v: number) {
    return this.u32(v >>> 0)
  }
  bytes(b: ArrayLike<number>) {
    this.room(b.length)
    this.buf.set(b, this.length)
    this.length += b.length
    return this
  }
  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i))
    return this
  }
  /** Overwrite a big/little-endian u32 at `at` (for lengths known only later). */
  setU32(at: number, v: number) {
    const b = this.le ? [v, v >> 8, v >> 16, v >>> 24] : [v >>> 24, v >> 16, v >> 8, v]
    for (let i = 0; i < 4; i++) this.buf[at + i] = b[i] & 255
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.length)
  }
}

/** Reads numbers from bytes; throws a clear error past the end. */
export class ByteReader {
  pos = 0
  private view: DataView
  constructor(
    readonly data: Uint8Array,
    private le = false,
  ) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }
  need(n: number) {
    if (this.pos + n > this.data.length) throw new Error('The file ends too early')
  }
  u8() {
    this.need(1)
    return this.data[this.pos++]
  }
  u16() {
    this.need(2)
    const v = this.view.getUint16(this.pos, this.le)
    this.pos += 2
    return v
  }
  i16() {
    this.need(2)
    const v = this.view.getInt16(this.pos, this.le)
    this.pos += 2
    return v
  }
  u32() {
    this.need(4)
    const v = this.view.getUint32(this.pos, this.le)
    this.pos += 4
    return v
  }
  i32() {
    this.need(4)
    const v = this.view.getInt32(this.pos, this.le)
    this.pos += 4
    return v
  }
  bytes(n: number) {
    this.need(n)
    const b = this.data.subarray(this.pos, this.pos + n)
    this.pos += n
    return b
  }
  ascii(n: number) {
    return String.fromCharCode(...this.bytes(n))
  }
  skip(n: number) {
    this.need(n)
    this.pos += n
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

/** CRC-32 as used by PNG. */
export function crc32(data: Uint8Array, start = 0, end = data.length): number {
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ data[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** PackBits run-length encoding (PSD and TIFF). */
export function packBits(src: Uint8Array): Uint8Array {
  const out: number[] = []
  let i = 0
  while (i < src.length) {
    // A run of 2+ equal bytes (3+ is always worth it; 2 only at the start of a literal is not).
    let run = 1
    while (i + run < src.length && run < 128 && src[i + run] === src[i]) run++
    if (run >= 3 || (run === 2 && i + 2 >= src.length)) {
      out.push(257 - run, src[i])
      i += run
      continue
    }
    // A literal stretch up to the next run of 3.
    let j = i
    while (j < src.length && j - i < 128 && !(j + 2 < src.length && src[j] === src[j + 1] && src[j] === src[j + 2])) j++
    out.push(j - i - 1)
    for (let k = i; k < j; k++) out.push(src[k])
    i = j
  }
  return Uint8Array.from(out)
}

/** Undo PackBits into `out` (its length is how many bytes to make). Returns bytes read. */
export function unpackBits(src: Uint8Array, out: Uint8Array): number {
  let i = 0
  let o = 0
  while (o < out.length && i < src.length) {
    const n = src[i++]
    if (n < 128) {
      const len = Math.min(n + 1, out.length - o)
      out.set(src.subarray(i, i + len), o)
      i += n + 1
      o += len
    } else if (n > 128) {
      const len = Math.min(257 - n, out.length - o)
      out.fill(src[i++], o, o + len)
      o += len
    }
  }
  return i
}
