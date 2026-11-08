import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES } from './builtinThemes'
import { contrastRatio } from './contrast'
import { OPENDECK_THEME } from './theme'
import { deriveColors, ensureContrast, issueLabel, readabilityIssues } from './themeColors'
import type { MainColor } from './types'

const mainOf = (c: typeof OPENDECK_THEME.colors): Record<MainColor, string> =>
  ({ bg: c.bg, surface: c.surface, text: c.text, accent: c.accent, accent2: c.accent2 })

describe('deriveColors', () => {
  it('derives readable helper colors for every built-in', () => {
    for (const t of BUILTIN_THEMES) {
      const out = deriveColors(mainOf(t.colors), t.colors, [])
      expect(readabilityIssues(out, []), t.name).toEqual([])
      for (const k of ['bg', 'surface', 'text', 'accent', 'accent2'] as const) expect(out[k]).toBe(t.colors[k])
    }
  })

  it('keeps colors the user set by hand', () => {
    const current = { ...OPENDECK_THEME.colors, muted: '#123456' }
    expect(deriveColors(mainOf(current), current, ['muted']).muted).toBe('#123456')
    expect(deriveColors(mainOf(current), current, []).muted).not.toBe('#123456')
  })

  it('picks white or the dark color for text on the accent, whichever reads better', () => {
    const light = deriveColors({ ...mainOf(OPENDECK_THEME.colors), accent: '#F5D90A' }, OPENDECK_THEME.colors, [])
    expect(light.onAccent).toBe(OPENDECK_THEME.colors.text)
    const dark = deriveColors({ ...mainOf(OPENDECK_THEME.colors), accent: '#1D5FD1' }, OPENDECK_THEME.colors, [])
    expect(dark.onAccent).toBe('#FFFFFF')
  })
})

describe('readabilityIssues', () => {
  it('flags hard-to-read accent text and offers a passing fix', () => {
    const colors = { ...OPENDECK_THEME.colors, accent: '#E8590C', onAccent: '#FFFFFF' }
    const [issue] = readabilityIssues(colors, ['onAccent'])
    expect(issue).toMatchObject({ fg: 'onAccent', bg: 'accent', min: 4.5, fix: { token: 'accent', verb: 'Darken' } })
    expect(issueLabel(issue, colors)).toBe('White text on Accent is 3.6:1')
    expect(contrastRatio('#FFFFFF', issue.fix.hex)).toBeGreaterThanOrEqual(4.5)
  })

  it('lightens on dark backgrounds', () => {
    const colors = { ...OPENDECK_THEME.colors, bg: '#0E1320', surface: '#182136', text: '#3A3F4A', muted: '#9AA6BA', accentText: '#3FD0C9', onAccent: '#0E1320', accent: '#3FD0C9' }
    const issues = readabilityIssues(colors, [])
    const textIssue = issues.find((i) => i.fg === 'text' && i.bg === 'bg')!
    expect(textIssue.fix).toMatchObject({ token: 'text', verb: 'Lighten' })
    expect(contrastRatio(textIssue.fix.hex, '#0E1320')).toBeGreaterThanOrEqual(4.5)
    expect(issueLabel(textIssue, colors)).toMatch(/^Text on Background is \d+\.\d:1$/)
  })

  it('fixes a hand-set helper color itself, otherwise the color in front', () => {
    const colors = { ...OPENDECK_THEME.colors, muted: '#C8C6D0' }
    expect(readabilityIssues(colors, ['muted']).every((i) => i.fix.token === 'muted')).toBe(true)
  })
})

describe('issueLabel', () => {
  it('never shows a failing ratio as the 4.5 it needs', () => {
    const issue = { fg: 'text' as const, bg: 'bg' as const, ratio: 4.47, min: 4.5 as const, fix: { token: 'text' as const, hex: '#000000', verb: 'Darken' as const } }
    expect(issueLabel(issue, OPENDECK_THEME.colors)).toBe('Text on Background is 4.4:1')
  })
})

describe('ensureContrast', () => {
  it('stops at the end of the range', () => {
    expect(['#000000', '#FFFFFF']).toContain(ensureContrast('#777777', ['#777777'], 21))
  })
  it('returns the color unchanged when it already passes', () => {
    expect(ensureContrast('#1c1b2a', ['#FCFBF8'], 4.5)).toBe('#1C1B2A')
  })
})
