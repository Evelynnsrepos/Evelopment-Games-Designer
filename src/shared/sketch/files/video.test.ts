import { unzlibSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { encodeApng } from './apng'
import { ByteReader, crc32 } from './bytes'
import { muxWebm } from './webm'

/** Read EBML elements: [id, body] pairs at one level. */
function ebml(data: Uint8Array): [number, Uint8Array][] {
  const out: [number, Uint8Array][] = []
  let p = 0
  const vint = (keepMarker: boolean) => {
    const first = data[p]
    let len = 1
    while (!(first & (0x80 >> (len - 1)))) len++
    let v = keepMarker ? first : first & (0xff >> len)
    for (let i = 1; i < len; i++) v = v * 256 + data[p + i]
    p += len
    return v
  }
  while (p < data.length) {
    const id = vint(true)
    const n = vint(false)
    out.push([id, data.subarray(p, p + n)])
    p += n
  }
  return out
}

describe('WebM', () => {
  it('nests header, segment, tracks and clusters with every frame', () => {
    const frame = (n: number) => Uint8Array.from({ length: n }, (_, i) => i & 255)
    const chunks = [
      { data: frame(300), time: 0, key: true },
      { data: frame(20), time: 33, key: false },
      { data: frame(20), time: 40000, key: false },
      { data: frame(200), time: 40033, key: true },
    ]
    const file = muxWebm(chunks, { width: 64, height: 48, codec: 'V_VP9', duration: 40066 })
    const top = ebml(file)
    expect(top.map((e) => e[0])).toEqual([0x1a45dfa3, 0x18538067])
    const seg = ebml(top[1][1])
    expect(seg.map((e) => e[0])).toEqual([0x1549a966, 0x1654ae6b, 0x1f43b675, 0x1f43b675, 0x1f43b675])
    const blocks = seg.filter((e) => e[0] === 0x1f43b675).flatMap((c) => ebml(c[1]).filter((e) => e[0] === 0xa3))
    expect(blocks.map((b) => b[1].length - 4)).toEqual([300, 20, 20, 200])
    expect(blocks[0][1][3]).toBe(0x80)
    expect(new TextDecoder().decode(seg[1][1]).includes('V_VP9')).toBe(true)
  })
})

describe('APNG', () => {
  it('writes valid chunks whose frames decode back to the pixels', () => {
    const px = (v: number) => ({ width: 3, height: 2, data: Uint8ClampedArray.from({ length: 24 }, (_, i) => (i * v) & 255) })
    const file = encodeApng([px(3), px(7)], [100, 250])
    const r = new ByteReader(file)
    r.skip(8)
    const chunks: { type: string; data: Uint8Array }[] = []
    while (r.pos < file.length) {
      const len = r.u32()
      const start = r.pos
      const type = r.ascii(4)
      const data = r.bytes(len)
      expect(r.u32()).toBe(crc32(file, start, start + 4 + len))
      chunks.push({ type, data })
    }
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'IEND'])
    const second = unzlibSync(chunks[5].data.subarray(4))
    // Undo the Sub filter of the first row.
    const row = [...second.subarray(1, 13)]
    for (let x = 4; x < 12; x++) row[x] = (row[x] + row[x - 4]) & 255
    expect(row).toEqual([...px(7).data.subarray(0, 12)])
  })
})
