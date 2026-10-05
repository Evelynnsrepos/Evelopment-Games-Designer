import { describe, expect, it } from 'vitest'
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, shiftColor } from './brushColor'

describe('brush colour', () => {
  it('round-trips through HSV', () => {
    for (const hex of ['#ff0000', '#12ab9c', '#808080', '#000000', '#ffffff', '#3355ee']) {
      expect(rgbToHex(...hsvToRgb(...rgbToHsv(...hexToRgb(hex))))).toBe(hex)
    }
  })

  it('shifts hue, saturation and brightness', () => {
    expect(shiftColor('#ff0000', 0, 0, 0)).toBe('#ff0000')
    // A third of the wheel: red to green.
    expect(shiftColor('#ff0000', 2 / 3, 0, 0)).toBe('#00ff00')
    expect(shiftColor('#ff0000', 0, -1, 0)).toBe('#ffffff')
    expect(shiftColor('#ff0000', 0, 0, -1)).toBe('#000000')
  })
})
