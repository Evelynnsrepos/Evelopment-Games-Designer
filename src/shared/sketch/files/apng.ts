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

/** `delays` in ms per frame. Loops forever. */
export function encodeApng(frames: Pixels[], delays: number[]): Uint8Array {
  const { width, height } = frames[0]
  const out = new ByteWriter()
  out.bytes([137, 80, 78, 71, 13, 10, 26, 10])
  chunk(out, 'IHDR', new ByteWriter().u32(width).u32(height).u8(8).u8(6).u8(0).u8(0).u8(0).done())
  chunk(out, 'acTL', new ByteWriter().u32(frames.length).u32(0).done())
  let seq = 0
  frames.forEach((f, i) => {
    const delay = Math.max(1, Math.min(65535, Math.round(delays[i] ?? 100)))
    chunk(out, 'fcTL', new ByteWriter().u32(seq++).u32(width).u32(height).u32(0).u32(0).u16(delay).u16(1000).u8(0).u8(0).done())
    const data = idat(f)
    if (i === 0) chunk(out, 'IDAT', data)
    else chunk(out, 'fdAT', new ByteWriter().u32(seq++).bytes(data).done())
  })
  chunk(out, 'IEND', new Uint8Array())
  return out.done()
}
