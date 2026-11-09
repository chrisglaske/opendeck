import type { ColorRef, DerivedColor, FontRef, TextEl, TextStyleId, ThemeColorToken } from './types'

export type ThemeTextStyle = { font: FontRef; size: number; weight: number; lineHeight: number; letterSpacing: number }
/** Where a deck's theme came from, so the editor can mark it current and spot a newer brand kit. */
export type ThemeSource = {
  kind: 'builtin' | 'kit'
  id: string
  name: string
  updatedAt: number
  /** The deck's theme was changed by hand after it was applied. */
  customized?: true
}

export type Theme = {
  id: string
  name: string
  colors: Record<Exclude<ThemeColorToken, 'accentTint'>, string>
  /** Font family names, e.g. "Manrope". */
  fonts: { heading: string; body: string }
  radius: number
  text: Record<TextStyleId, ThemeTextStyle>
  /** Asset ids of the logo; `dark` is used on dark slides when present. */
  logo: { main?: string; dark?: string }
  /** Helper colors the person set by hand; the rest are worked out from the main colors. */
  manualColors: DerivedColor[]
  source: ThemeSource | null
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
  logo: {},
  manualColors: [],
  source: { kind: 'builtin', id: 'opendeck', name: 'OpenDeck', updatedAt: 0 },
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/**
 * Self-hosted fonts register as "<Name> Variable"; the plain name covers uploaded and
 * installed fonts. `fallback` is used when neither is available.
 */
const fontStack = (name: string, fallback: string) => `'${name} Variable', '${name}', ${fallback}`
const SYSTEM_FALLBACK = 'system-ui, sans-serif'

/** Corner radius in slide units; `'theme'` follows the theme's corner style. */
export function radiusPx(r: number | 'theme', t: Theme): number {
  return r === 'theme' ? t.radius : r
}

/** CSS `font-family` for a text element: a hand-set family (falling back to the body font) or its theme role. */
export function fontFamilyOf(el: TextEl, t: Theme): string {
  if (el.fontFamily) return fontStack(el.fontFamily, 'var(--t-font-body)')
  return `var(--t-font-${el.font ?? t.text[el.style].font})`
}

/** CSS custom properties for a theme, set on the slide root through the React style prop. */
export function themeVars(t: Theme): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(t.colors)) out[`--t-${kebab(k)}`] = v
  out['--t-accent-tint'] = `color-mix(in srgb, ${t.colors.accent} 14%, ${t.colors.bg})`
  const body = fontStack(t.fonts.body, SYSTEM_FALLBACK)
  out['--t-font-heading'] = fontStack(t.fonts.heading, body)
  out['--t-font-body'] = body
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
  return {
    fontFamily: fontFamilyOf(el, t),
    size: el.size ?? s.size,
    weight: s.weight,
    lineHeight: el.lineHeight ?? s.lineHeight,
    letterSpacing: el.letterSpacing ?? s.letterSpacing,
    color: resolveColor(el.color ?? { theme: 'text' }),
  }
}
