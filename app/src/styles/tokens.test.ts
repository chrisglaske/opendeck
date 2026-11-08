import { describe, expect, it } from 'vitest'
import css from './tokens.css?raw'
import { contrastRatio, readTokens } from '../test/contrast'

const MODES = ['light', 'dark'] as const

const TEXT_PAIRS: [fg: string, bg: string][] = [
  ['ink', 'bg'],
  ['ink', 'raised'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'subtle'],
  ['faint', 'bg'],
  ['faint', 'surface'],
  ['faint', 'raised'],
  ['faint', 'subtle'],
  ['accent-text', 'bg'],
  ['accent-text', 'surface'],
  ['accent-text', 'accent-tint'],
  ['on-accent', 'accent'],
  ['success', 'success-tint'],
  ['warning', 'warning-tint'],
  ['danger', 'danger-tint'],
  ['danger', 'bg'],
  ['toast-link', 'ink'],
  ['bg', 'ink'],
]

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
  })
  it('is 1 for identical colors', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1)
  })
})

describe('tokens.css', () => {
  it('both modes define the same token names', () => {
    const light = Object.keys(readTokens(css, 'light')).sort()
    const dark = Object.keys(readTokens(css, 'dark')).sort()
    expect(light.length).toBeGreaterThan(20)
    expect(dark).toEqual(light)
  })

  const cases = MODES.flatMap((mode) => TEXT_PAIRS.map(([fg, bg]) => [mode, fg, bg] as const))
  it.each(cases)('every text pair meets AA: %s %s on %s', (mode, fg, bg) => {
    const t = readTokens(css, mode)
    expect(t[`--${fg}`], `--${fg}`).toMatch(/^#[0-9a-f]{6}$/i)
    expect(t[`--${bg}`], `--${bg}`).toMatch(/^#[0-9a-f]{6}$/i)
    expect(contrastRatio(t[`--${fg}`], t[`--${bg}`])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['bg', 'surface', 'raised', 'subtle'])('dark backgrounds carry no violet tint: %s', (name) => {
    const hex = readTokens(css, 'dark')[`--${name}`]
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(4)
  })
})

describe('editor tokens', () => {
  it('uses the firmer control borders', () => {
    expect(readTokens(css, 'light')['--line-strong']).toBe('#B9B4C6')
    expect(readTokens(css, 'dark')['--line-strong']).toBe('#55555D')
  })
  it('defines snap guide and readout colors', () => {
    expect(readTokens(css, 'light')['--guide']).toBe('#E2457A')
    expect(readTokens(css, 'dark')['--guide']).toBe('#FF6B9A')
    expect(readTokens(css, 'light')['--readout-bg']).toBe('#1C1B2A')
    expect(readTokens(css, 'dark')['--readout-bg']).toBe('#1C1B2A')
  })
  it('keeps the no-JS dark fallback in sync with dark mode', () => {
    const media = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-mode\]\)\s*\{([^{}]*)\}/.exec(css)
    expect(media).not.toBeNull()
    const fallback = readTokens(`[data-mode="dark"] {${media![1]}}`, 'dark')
    expect(fallback).toEqual(readTokens(css, 'dark'))
  })
})
