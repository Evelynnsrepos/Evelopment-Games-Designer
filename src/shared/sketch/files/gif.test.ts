import { describe, expect, it } from 'vitest'
import { encodeGif, lzw, palette } from './gif'
import { readTiff, writeTiff } from './tiff'

/** A plain GIF LZW decoder, to check the encoder against. */
function unlzw(blocks: Uint8Array, minCode: number, n: number): number[] {
  const bytes: number[] = []
  for (let i = 0; blocks[i]; i += blocks[i] + 1) bytes.push(...blocks.subarray(i + 1, i + 1 + blocks[i]))
  const clear = 1 << minCode
  let size = minCode + 1
  let dict: number[][] = []
  const reset = () => {
    dict = Array.from({ length: clear + 2 }, (_, i) => [i])
    size = minCode + 1
  }
  reset()
  const out: number[] = []
  let pos = 0
  let prev: number[] | null = null
  const read = () => {
    let v = 0
    for (let b = 0; b < size; b++, pos++) v |= ((bytes[pos >> 3] >> (pos & 7)) & 1) << b
    return v
  }
  while (out.length < n) {
    const code = read()
    if (code === clear) {
      reset()
      prev = null
      continue
    }
    if (code === clear + 1) break
    const entry: number[] = code < dict.length ? dict[code] : [...prev!, prev![0]]
    out.push(...entry)
    if (prev && dict.length < 4096) dict.push([...prev, entry[0]])
    if (dict.length === 1 << size && size < 12) size++
    prev = entry
  }
  return out
}

describe('GIF', () => {
  it('LZW round-trips long and varied input past a full code table', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) % 256
    const src = Uint8Array.from({ length: 30000 }, (_, i) => (i % 5000 < 2500 ? rnd() : i % 7))
    expect(unlzw(lzw(src, 8), 8, src.length)).toEqual([...src])
  })

  it('finds the main colours of a picture', () => {
    const data = new Uint8ClampedArray(400 * 4)
    for (let p = 0; p < 400; p++) data.set(p < 200 ? [250, 0, 0, 255] : [0, 0, 250, 255], p * 4)
    const pal = palette(data)
    expect(pal).toHaveLength(2)
    expect(pal.some((c) => c[0] > 240 && c[2] < 10)).toBe(true)
  })

  it('writes a looping animation', () => {
    const px = (v: number) => ({ width: 2, height: 2, data: new Uint8ClampedArray(16).fill(v) })
    const gif = encodeGif([
      { pixels: px(255), delay: 100 },
      { pixels: px(0), delay: 100 },
    ])
    expect(String.fromCharCode(...gif.subarray(0, 6))).toBe('GIF89a')
    expect(new TextDecoder().decode(gif).includes('NETSCAPE2.0')).toBe(true)
    expect(gif[gif.length - 1]).toBe(0x3b)
  })
})

describe('TIFF', () => {
  it('round-trips RGBA pixels', () => {
    const p = { width: 3, height: 2, data: Uint8ClampedArray.from({ length: 24 }, (_, i) => i * 10) }
    const back = readTiff(writeTiff(p))
    expect([back.width, back.height]).toEqual([3, 2])
    expect([...back.data]).toEqual([...p.data])
  })
})
