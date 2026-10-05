import { describe, expect, it } from 'vitest'
import { parseAbr } from './abr'

/** Big-endian byte builder. */
class W {
  b: number[] = []
  u8(v: number) { this.b.push(v & 255); return this }
  u16(v: number) { return this.u8(v >> 8).u8(v) }
  u32(v: number) { return this.u16(v >>> 16).u16(v) }
  str(s: string) { for (const c of s) this.u8(c.charCodeAt(0)); return this }
  bytes(a: number[]) { this.b.push(...a); return this }
  get out() { return new Uint8Array(this.b) }
}

/** One v6 sampled brush entry, 3×2 px. */
function v6Brush(compressed: boolean) {
  const w = new W()
  w.bytes(new Array(47).fill(0)) // id + extra data (subversion 1)
  w.u32(0).u32(0).u32(2).u32(3) // top, left, bottom, right
  w.u16(8).u8(compressed ? 1 : 0)
  if (!compressed) w.bytes([0, 128, 255, 10, 20, 30])
  else {
    // Row 1: a run of three 200s; row 2: three literal bytes.
    w.u16(2).u16(4)
    w.u8(-2 & 255).u8(200)
    w.u8(2).u8(1).u8(2).u8(3)
  }
  return w.b
}

function v6File(compressed: boolean) {
  const brush = v6Brush(compressed)
  const pad = (4 - (brush.length % 4)) % 4
  const samp = new W().u32(brush.length).bytes(brush).bytes(new Array(pad).fill(0)).b
  const w = new W().u16(6).u16(1)
  w.str('8BIM').str('desc').u32(4).bytes([1, 2, 3, 4])
  w.str('8BIM').str('samp').u32(samp.length).bytes(samp)
  return w.out
}

describe('abr', () => {
  it('reads raw and compressed v6 tips', () => {
    const [raw] = parseAbr(v6File(false))
    expect([raw.width, raw.height]).toEqual([3, 2])
    expect([...raw.gray]).toEqual([0, 128, 255, 10, 20, 30])
    const [rle] = parseAbr(v6File(true))
    expect([...rle.gray]).toEqual([200, 200, 200, 1, 2, 3])
  })

  it('reads v2 tips with names and spacing', () => {
    const body = new W().u32(0).u16(25).u32(2).u16(65).u16(0).u8(1).bytes(new Array(8).fill(0)).u32(0).u32(0).u32(1).u32(2).u16(8).u8(0).bytes([7, 9]).b
    const file = new W().u16(2).u16(2).u16(1).u32(0).u16(2).u32(body.length).bytes(body).out
    const tips = parseAbr(file)
    expect(tips).toHaveLength(1)
    expect(tips[0].name).toBe('A')
    expect(tips[0].spacing).toBe(0.25)
    expect([...tips[0].gray]).toEqual([7, 9])
  })

  it('refuses unknown versions kindly', () => {
    expect(() => parseAbr(new W().u16(99).out)).toThrow(/version 99/)
  })
})
