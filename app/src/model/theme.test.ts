import { describe, expect, it } from 'vitest'
import { fontFamilyOf, OPENDECK_THEME, radiusPx, resolveColor, textStyleOf, themeVars } from './theme'
import { createLogo, createShape, createText } from './factory'
import { contrastRatio, mixHex } from './contrast'

describe('resolveColor', () => {
  it('maps a theme token to its CSS variable', () => {
    expect(resolveColor({ theme: 'accentText' })).toBe('var(--t-accent-text)')
    expect(resolveColor({ theme: 'bg' })).toBe('var(--t-bg)')
  })
  it('returns a custom hex as is', () => {
    expect(resolveColor({ hex: '#0F7B6C' })).toBe('#0F7B6C')
  })
})

describe('themeVars', () => {
  const vars = themeVars(OPENDECK_THEME)
  it('exposes theme colors', () => {
    expect(vars['--t-bg']).toBe('#FCFBF8')
    expect(vars['--t-accent-text']).toBe('#5236D6')
    expect(vars['--t-on-accent']).toBe('#FFFFFF')
  })
  it('derives the accent tint', () => {
    expect(vars['--t-accent-tint']).toBe('color-mix(in srgb, #6C4CF5 14%, #FCFBF8)')
  })
  it('picks a readable color for text on accent2, even when accent2 is as dark as the text', () => {
    const boardroom = { ...OPENDECK_THEME, colors: { ...OPENDECK_THEME.colors, text: '#0F2235', bg: '#FFFFFF', accent2: '#0F2235' } }
    const on = themeVars(boardroom)['--t-on-accent2']
    for (const end of ['#0F2235', mixHex('#0F2235', '#0F2235', 60)]) expect(contrastRatio(on, end)).toBeGreaterThanOrEqual(4.5)
    // A light accent2 keeps dark text.
    expect(vars['--t-on-accent2']).toBe(OPENDECK_THEME.colors.text)
  })
  it('falls back to the text color when accent2 is not a plain hex', () => {
    const odd = { ...OPENDECK_THEME, colors: { ...OPENDECK_THEME.colors, accent2: 'red' } }
    expect(themeVars(odd)['--t-on-accent2']).toBe(OPENDECK_THEME.colors.text)
  })
  it('exposes fonts and radius', () => {
    expect(vars['--t-font-heading']).toContain('Manrope')
    expect(vars['--t-font-body']).toContain('Inter')
    expect(vars['--t-radius']).toBe('27px')
  })
})

describe('OPENDECK_THEME', () => {
  it('has the approved colors', () => {
    expect(OPENDECK_THEME.colors).toEqual({
      bg: '#FCFBF8', surface: '#F3F1F7', text: '#1C1B2A', muted: '#5A5868', accent: '#6C4CF5',
      accentText: '#5236D6', onAccent: '#FFFFFF', accent2: '#FFC9B5', line: '#E6E2EE',
    })
  })
  it('has the agreed text styles', () => {
    expect(OPENDECK_THEME.text.title).toEqual({ font: 'heading', size: 112, weight: 800, lineHeight: 1.04, letterSpacing: -0.035 })
    expect(OPENDECK_THEME.text.heading).toEqual({ font: 'heading', size: 64, weight: 800, lineHeight: 1.1, letterSpacing: -0.03 })
    expect(OPENDECK_THEME.text.body).toEqual({ font: 'body', size: 40, weight: 400, lineHeight: 1.45, letterSpacing: 0 })
    expect(OPENDECK_THEME.text.caption).toEqual({ font: 'body', size: 28, weight: 500, lineHeight: 1.4, letterSpacing: 0 })
  })
})

describe('textStyleOf', () => {
  it('uses the theme style for the element', () => {
    const s = textStyleOf(createText('title'), OPENDECK_THEME)
    expect(s.size).toBe(112)
    expect(s.weight).toBe(800)
    expect(s.fontFamily).toBe('var(--t-font-heading)')
    expect(s.color).toBe('var(--t-text)')
  })
  it('lets element overrides win', () => {
    const el = { ...createText('title'), size: 90, font: 'body' as const, color: { hex: '#112233' }, lineHeight: 1.2, letterSpacing: 0.01 }
    const s = textStyleOf(el, OPENDECK_THEME)
    expect(s).toMatchObject({ size: 90, fontFamily: 'var(--t-font-body)', color: '#112233', lineHeight: 1.2, letterSpacing: 0.01 })
  })
})

describe('theme-bound corners, fonts and logos', () => {
  it('resolves theme corners and hand-set corners', () => {
    expect(radiusPx('theme', OPENDECK_THEME)).toBe(27)
    expect(radiusPx(12, OPENDECK_THEME)).toBe(12)
  })
  it('falls back from a missing heading font to the body font', () => {
    const v = themeVars({ ...OPENDECK_THEME, fonts: { heading: 'Acme Sans', body: 'Inter' } })
    expect(v['--t-font-heading']).toBe("'Acme Sans Variable', 'Acme Sans', 'Inter Variable', 'Inter', system-ui, sans-serif")
    expect(v['--t-font-body']).toBe("'Inter Variable', 'Inter', system-ui, sans-serif")
  })
  it('lets a hand-set family win and fall back to the body font', () => {
    const el = { ...createText('title'), font: 'heading' as const, fontFamily: 'Lora' }
    expect(fontFamilyOf(el, OPENDECK_THEME)).toBe("'Lora Variable', 'Lora', var(--t-font-body)")
    expect(textStyleOf(el, OPENDECK_THEME).fontFamily).toBe(fontFamilyOf(el, OPENDECK_THEME))
  })
  it('new rectangles follow the theme corners', () => {
    expect(createShape('rect').radius).toBe('theme')
    expect(createShape('ellipse').radius).toBe(0)
  })
  it('creates a logo box', () => {
    expect(createLogo()).toMatchObject({ type: 'logo', x: 134, y: 97, w: 320, h: 120, rotation: 0, locked: false })
  })
  it('the default theme has no logo, no hand-set colors and a built-in source', () => {
    expect(OPENDECK_THEME.logo).toEqual({})
    expect(OPENDECK_THEME.manualColors).toEqual([])
    expect(OPENDECK_THEME.source).toEqual({ kind: 'builtin', id: 'opendeck', name: 'OpenDeck', updatedAt: 0 })
  })
})
