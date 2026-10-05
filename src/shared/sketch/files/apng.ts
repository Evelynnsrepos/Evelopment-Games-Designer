import { zlibSync } from 'fflate'
import { ByteWriter, crc32 } from './bytes'
import type { Pixels } from './psd'

/**
 * Animated PNG writer (Sketch Pro), RGBA 8-bit, compressed with the zlib we
 * already ship (fflate). All frames must be the same size.
 */

function chunk(w: ByteWriter, type: string, data: Uint8Array) {
  const body = new ByteWriter().ascii(type).bytes(data).done()
  w.u32(data.length).bytes(body).u32(crc32(body))
}

/** Rows with the "Sub" filter (each byte minus the one a pixel to its left), then zlib. */
function idat(p: Pixels): Uint8Array {
  const stride = p.width * 4
  const raw = new Uint8Array((stride + 1) * p.height)
  for (let y = 0; y < p.height; y++) {
    const o = y * (stride + 1)
    raw[o] = 1
    for (let x = 0; x < stride; x++) raw[o + 1 + x] = (p.data[y * stride + x] - (x >= 4 ? p.data[y * stride + x - 4] : 0)) & 255
  }
  return zlibSync(raw, { level: 6 })
}

/** Adds frames one at a time (only the compressed data is kept). Loops forever. */
export class ApngEncoder {
  private body = new ByteWriter()
  private seq = 0
  private frames = 0
  private width: number
  private height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  /** `delay` in ms. */
  add(p: Pixels, delay: number) {
    const ms = Math.max(1, Math.min(65535, Math.round(delay)))
    chunk(this.body, 'fcTL', new ByteWriter().u32(this.seq++).u32(this.width).u32(this.height).u32(0).u32(0).u16(ms).u16(1000).u8(0).u8(0).done())
    const data = idat(p)
    if (this.frames++ === 0) chunk(this.body, 'IDAT', data)
    else chunk(this.body, 'fdAT', new ByteWriter().u32(this.seq++).bytes(data).done())
  }

  done(): Uint8Array {
    const out = new ByteWriter()
    out.bytes([137, 80, 78, 71, 13, 10, 26, 10])
    chunk(out, 'IHDR', new ByteWriter().u32(this.width).u32(this.height).u8(8).u8(6).u8(0).u8(0).u8(0).done())
    chunk(out, 'acTL', new ByteWriter().u32(this.frames).u32(0).done())
    out.bytes(this.body.done())
    chunk(out, 'IEND', new Uint8Array())
    return out.done()
  }
}

export function encodeApng(frames: Pixels[], delays: number[]): Uint8Array {
  const a = new ApngEncoder(frames[0].width, frames[0].height)
  frames.forEach((f, i) => a.add(f, delays[i] ?? 100))
  return a.done()
}
