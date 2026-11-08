import { describe, expect, it } from 'vitest'
import { OPENDECK_THEME, resolveColor, textStyleOf, themeVars } from './theme'
import { createText } from './factory'

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
