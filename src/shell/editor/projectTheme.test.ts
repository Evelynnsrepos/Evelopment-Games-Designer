import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_THEME } from '@/core/model'
import { hexToRgb, themeVars } from './projectTheme'

const base = { bg: '#15161a', sunken: '#101114' }

describe('themeVars', () => {
  it('changes nothing for the default theme', () => {
    expect(themeVars(DEFAULT_PROJECT_THEME, base)).toEqual({})
  })
  it('makes panels see-through only with a wallpaper', () => {
    const v = themeVars({ ...DEFAULT_PROJECT_THEME, wallpaper: 'assets/images/a.png', panelOpacity: 50 }, base)
    expect(v['--bg']).toBe('rgb(21 22 26 / 0.5)')
  })
  it('picks readable text and accent text', () => {
    const v = themeVars({ ...DEFAULT_PROJECT_THEME, background: '#ffffff', accent: '#111111' }, base)
    expect(v['--text']).toBe('#1c1d22')
    expect(v['--accent-text']).toBe('#ffffff')
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
  })
})
