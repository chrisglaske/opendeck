import { describe, expect, it } from 'vitest'
import { OPENDECK_THEME } from '../model/theme'
import { deriveColors } from '../model/themeColors'
import { v1Header, v1Theme } from './branding'
import { V1_DEFAULTS } from './normalize'
import type { V1Settings } from './types'
import { v1Projects } from './testFixtures'

const settings = (over: Partial<V1Settings> = {}): V1Settings => ({
  ...V1_DEFAULTS, customFontUrl: '', customFontFamily: '', savedFonts: [], ...over,
})

describe('v1Theme', () => {
  it('is null when every setting is V1 default', () => {
    expect(v1Theme(settings(), null, 'Deck')).toBeNull()
  })

  it("builds on the default theme with branded.json's accent, font and logo", () => {
    const [p] = v1Projects('branded')
    const t = v1Theme(p.data.globalSettings, 'logo-key', p.name)!
    expect(t.colors.accent).toBe('#E8590C')
    const { muted, accentText, onAccent, line, ...main } = t.colors
    expect({ muted, accentText, onAccent, line }).toMatchObject(
      (({ muted, accentText, onAccent, line }) => ({ muted, accentText, onAccent, line }))(deriveColors({ ...main }, OPENDECK_THEME.colors, [])),
    )
    expect(t.fonts).toEqual({ heading: 'Playfair Display', body: 'Playfair Display' })
    expect(t.logo).toEqual({ main: 'logo-key' })
    expect(t.name).toBe('Branded deck theme')
    expect(t.id).not.toBe(OPENDECK_THEME.id)
    expect(t.source).toBeNull()
    expect(t.text).toEqual(OPENDECK_THEME.text)
    expect(t.colors.bg).toBe(OPENDECK_THEME.colors.bg)
  })

  it('keeps bundled fonts, turns Roboto into Inter and custom fonts into the default fonts', () => {
    expect(v1Theme(settings({ font: "'Space Grotesk', sans-serif" }), null, 'D')!.fonts).toEqual({ heading: 'Space Grotesk', body: 'Space Grotesk' })
    expect(v1Theme(settings({ font: "'Roboto', sans-serif" }), null, 'D')!.fonts).toEqual({ heading: 'Inter', body: 'Inter' })
    const custom = settings({ font: "'Comic Neue', cursive", customFontFamily: 'Comic Neue', customFontUrl: 'https://fonts.example/x.css' })
    expect(v1Theme(custom, null, 'D')).toBeNull()
  })

  it('ignores an accent that is not a plain hex color', () => {
    expect(v1Theme(settings({ theme: 'red; background:url(x)' }), null, 'D')).toBeNull()
    expect(v1Theme(settings({ theme: '#e8590c' }), null, 'D')!.colors.accent).toBe('#E8590C')
  })

  it('uses only a logo when only a logo is set', () => {
    const t = v1Theme(settings(), 'k', 'D')!
    expect(t.logo).toEqual({ main: 'k' })
    expect(t.colors).toEqual(OPENDECK_THEME.colors)
  })
})

describe('v1Header', () => {
  it('is null for V1 defaults and keeps custom header text and badge', () => {
    expect(v1Header(settings())).toBeNull()
    expect(v1Header(settings({ headerText: 'Northwind', headerIcon: 'NW' }))).toEqual({ text: 'Northwind', badge: 'NW' })
    expect(v1Header(settings({ headerText: 'Northwind' }))).toEqual({ text: 'Northwind', badge: '' })
  })
})
