import { describe, expect, it } from 'vitest'
import { frameIds, frameOf, normalizeAnimation, onionSkins, playable, sequence, showFrames } from './assist'
import { newLayer, type SketchLayer } from './model'

const layer = (id: string, extra: Partial<SketchLayer> = {}): SketchLayer => ({ ...newLayer(id), id, ...extra })

// Bottom to top: a, group g (with b inside), c, a mask on c.
const stack = [layer('a'), layer('b', { parent: 'g' }), layer('g', { kind: 'group' }), layer('c'), layer('m', { kind: 'mask' })]

describe('frames', () => {
  it('treats each top-level layer or group as a frame', () => {
    expect(frameIds(stack)).toEqual(['a', 'g', 'c'])
    expect(frameOf(stack, 'b')).toBe(1)
    expect(frameOf(stack, 'm')).toBe(2)
    expect(frameOf(stack, 'zzz')).toBe(-1)
  })

  it('hides every frame but the shown ones', () => {
    const v = showFrames(stack, frameIds(stack), [0, 2])
    expect(v.filter((l) => !l.visible).map((l) => l.id)).toEqual(['g'])
  })

  it('keeps background and foreground frames out of playback', () => {
    expect(playable(4, { background: true, foreground: true })).toEqual([1, 2])
    expect(playable(1, { background: true, foreground: true })).toEqual([0])
    expect(playable(3, { background: false, foreground: false })).toEqual([0, 1, 2])
  })

  it('plays holds and ping-pong', () => {
    const ids = ['a', 'b', 'c', 'd']
    expect(sequence(ids, [0, 1, 2, 3], { b: 2 }, 'loop')).toEqual([0, 1, 1, 1, 2, 3])
    expect(sequence(ids, [0, 1, 2, 3], {}, 'pingpong')).toEqual([0, 1, 2, 3, 2, 1])
  })

  it('finds onion skin frames nearest first, wrapping when looping', () => {
    const s = { onion: 2, onionOpacity: 0.5, mode: 'loop' as const }
    expect(onionSkins(0, [0, 1, 2, 3, 4], s).map((o) => [o.frame, o.before])).toEqual([
      [4, true],
      [1, false],
      [3, true],
      [2, false],
    ])
    expect(onionSkins(0, [0, 1, 2], { ...s, mode: 'once' }).map((o) => o.frame)).toEqual([1, 2])
    expect(onionSkins(1, [0, 1, 2], { ...s, onion: 0 })).toEqual([])
  })

  it('normalizes saved settings', () => {
    const a = normalizeAnimation({ fps: 500, onion: -3, mode: 'x' as never })
    expect([a.fps, a.onion, a.mode]).toEqual([60, 0, 'loop'])
  })
})
