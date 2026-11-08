import type { ColorRef, FontRef, TextEl, TextStyleId, ThemeColorToken } from './types'

export type ThemeTextStyle = { font: FontRef; size: number; weight: number; lineHeight: number; letterSpacing: number }
export type Theme = {
  id: string
  name: string
  colors: Record<Exclude<ThemeColorToken, 'accentTint'>, string>
  /** Font family names, e.g. "Manrope". */
  fonts: { heading: string; body: string }
  radius: number
  text: Record<TextStyleId, ThemeTextStyle>
}

export const OPENDECK_THEME: Theme = {
  id: 'opendeck',
  name: 'OpenDeck',
  colors: {
    bg: '#FCFBF8', surface: '#F3F1F7', text: '#1C1B2A', muted: '#5A5868', accent: '#6C4CF5',
    accentText: '#5236D6', onAccent: '#FFFFFF', accent2: '#FFC9B5', line: '#E6E2EE',
  },
  fonts: { heading: 'Manrope', body: 'Inter' },
  radius: 27,
  text: {
    title: { font: 'heading', size: 112, weight: 800, lineHeight: 1.04, letterSpacing: -0.035 },
    heading: { font: 'heading', size: 64, weight: 800, lineHeight: 1.1, letterSpacing: -0.03 },
    body: { font: 'body', size: 40, weight: 400, lineHeight: 1.45, letterSpacing: 0 },
    caption: { font: 'body', size: 28, weight: 500, lineHeight: 1.4, letterSpacing: 0 },
  },
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/** Self-hosted fonts register as "<Name> Variable"; the plain name is the fallback. */
const fontStack = (name: string) => `'${name} Variable', '${name}', system-ui, sans-serif`

/** CSS custom properties for a theme, set on the slide root through the React style prop. */
export function themeVars(t: Theme): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(t.colors)) out[`--t-${kebab(k)}`] = v
  out['--t-accent-tint'] = `color-mix(in srgb, ${t.colors.accent} 14%, ${t.colors.bg})`
  out['--t-font-heading'] = fontStack(t.fonts.heading)
  out['--t-font-body'] = fontStack(t.fonts.body)
  out['--t-radius'] = `${t.radius}px`
  return out
}

export function resolveColor(c: ColorRef): string {
  return 'theme' in c ? `var(--t-${kebab(c.theme)})` : c.hex
}

export type EffectiveTextStyle = { fontFamily: string; size: number; weight: number; lineHeight: number; letterSpacing: number; color: string }

/** The text style an element ends up with: element overrides win over its theme style. */
export function textStyleOf(el: TextEl, t: Theme): EffectiveTextStyle {
  const s = t.text[el.style]
  const font = el.font ?? s.font
  return {
    fontFamily: `var(--t-font-${font})`,
    size: el.size ?? s.size,
    weight: s.weight,
    lineHeight: el.lineHeight ?? s.lineHeight,
    letterSpacing: el.letterSpacing ?? s.letterSpacing,
    color: resolveColor(el.color ?? { theme: 'text' }),
  }
}
