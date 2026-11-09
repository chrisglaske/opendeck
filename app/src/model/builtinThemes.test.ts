import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, builtinTheme, CORNER_PRESETS } from './builtinThemes'
import { contrastRatio } from './contrast'
import { OPENDECK_THEME } from './theme'

describe('built-in themes', () => {
  it('has the six approved themes', () => {
    expect(BUILTIN_THEMES.map((t) => t.name)).toEqual(['OpenDeck', 'Boardroom', 'Editorial', 'Midnight', 'Sage', 'Swiss'])
    expect(BUILTIN_THEMES[0]).toEqual(OPENDECK_THEME)
  })

  it('uses one of the corner tiles for every theme, so Corners always shows a choice', () => {
    const tiles = CORNER_PRESETS.map((p) => p.px)
    for (const t of BUILTIN_THEMES) expect(tiles, t.name).toContain(t.radius)
  })

  it.each([
    ['boardroom', { bg: '#FFFFFF', surface: '#EEF2F7', text: '#0F2235', muted: '#4A5A6C', accent: '#1D5FD1', accentText: '#1D5FD1', onAccent: '#FFFFFF', accent2: '#0F2235', line: '#DCE3EC' }, 'IBM Plex Sans', 'IBM Plex Sans', 12, 600, -0.015],
    ['editorial', { bg: '#F6F1E9', surface: '#ECE4D6', text: '#221C16', muted: '#665B4F', accent: '#B0432A', accentText: '#A33D25', onAccent: '#FFFFFF', accent2: '#2F4A3A', line: '#DDD2C0' }, 'Fraunces', 'Inter', 0, 600, -0.01],
    ['midnight', { bg: '#0E1320', surface: '#182136', text: '#EEF2F8', muted: '#9AA6BA', accent: '#3FD0C9', accentText: '#3FD0C9', onAccent: '#0E1320', accent2: '#F5B94A', line: '#263049' }, 'Space Grotesk', 'Inter', 12, 700, -0.025],
    ['sage', { bg: '#F2F4EE', surface: '#E2E9DA', text: '#1D2B22', muted: '#4F5E53', accent: '#2E7650', accentText: '#2A6C49', onAccent: '#FFFFFF', accent2: '#E7B56A', line: '#D3DCC9' }, 'DM Sans', 'DM Sans', 46, 700, -0.03],
    ['swiss', { bg: '#FFFFFF', surface: '#F1F1F1', text: '#111111', muted: '#555555', accent: '#E1251B', accentText: '#C81E15', onAccent: '#FFFFFF', accent2: '#111111', line: '#DDDDDD' }, 'Inter Tight', 'Inter', 0, 800, -0.045],
  ])('%s has the approved values', (id, colors, heading, body, radius, titleWeight, titleLs) => {
    const t = builtinTheme(id)!
    expect(t.colors).toEqual(colors)
    expect(t.fonts).toEqual({ heading, body })
    expect(t.radius).toBe(radius)
    expect(t.text.title).toMatchObject({ weight: titleWeight, letterSpacing: titleLs, size: 112 })
    expect(t.text.heading).toMatchObject({ weight: titleWeight, letterSpacing: titleLs, size: 64 })
    expect(t.text.body).toEqual(OPENDECK_THEME.text.body)
    expect(t.text.caption).toEqual(OPENDECK_THEME.text.caption)
    expect(t.source).toEqual({ kind: 'builtin', id, name: t.name, updatedAt: 0 })
    expect(t.logo).toEqual({})
    expect(t.manualColors).toEqual([])
  })

  it('every built-in passes AA for its text pairs', () => {
    for (const t of BUILTIN_THEMES) {
      const c = t.colors
      const pairs: [string, string][] = [[c.text, c.bg], [c.muted, c.bg], [c.accentText, c.bg], [c.onAccent, c.accent], [c.muted, c.surface]]
      for (const [fg, bg] of pairs) expect(contrastRatio(fg, bg), `${t.name} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('hands out copies, so editing one never changes the built-in', () => {
    const t = builtinTheme('swiss')!
    t.colors.bg = '#000000'
    expect(builtinTheme('swiss')!.colors.bg).toBe('#FFFFFF')
    expect(builtinTheme('nope')).toBeUndefined()
  })

  it('offers four corner styles', () => {
    expect(CORNER_PRESETS.map((p) => [p.id, p.label, p.px])).toEqual([
      ['square', 'Square', 0], ['slight', 'Slight', 12], ['soft', 'Soft', 27], ['round', 'Round', 46],
    ])
  })
})
