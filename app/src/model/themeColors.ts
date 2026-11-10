/**
 * Works out a theme's helper colors from its five main colors and checks that text stays readable.
 * Pure functions; the brand kit editor uses them on every change.
 */
import { contrastRatio, mixHex, relativeLuminance } from './contrast'
import type { Theme } from './theme'
import type { DerivedColor, MainColor, ThemeColorToken } from './types'

type Colors = Theme['colors']
type Hsl = { h: number; s: number; l: number }

const AA = 4.5

function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h: (h * 60 + 360) % 360, s, l: l * 100 }
}

function hslToHex({ h, s, l }: Hsl): string {
  const L = l / 100
  const a = s * Math.min(L, 1 - L)
  const f = (k: number) => {
    const x = (k + h / 30) % 12
    return L - a * Math.max(-1, Math.min(x - 3, 9 - x, 1))
  }
  const byte = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')
  return `#${byte(f(0))}${byte(f(8))}${byte(f(4))}`.toUpperCase()
}

const passes = (hex: string, against: readonly string[], min: number) => against.every((b) => contrastRatio(hex, b) >= min)

/**
 * Moves `hex` lighter or darker, one lightness point at a time, until it reaches `min` contrast
 * against every color in `against`, or the end of the range. It moves away from their average
 * brightness: darker on light backgrounds, lighter on dark ones.
 */
export function ensureContrast(hex: string, against: readonly string[], min: number): string {
  const start = hex.toUpperCase()
  if (passes(start, against, min)) return start
  const mean = against.reduce((sum, b) => sum + relativeLuminance(b), 0) / Math.max(1, against.length)
  const own = relativeLuminance(start)
  const step = own < mean || (own === mean && mean >= 0.179) ? -1 : 1
  const hsl = hexToHsl(start)
  let out = start
  for (let l = Math.round(hsl.l) + step; l >= 0 && l <= 100; l += step) {
    out = hslToHex({ ...hsl, l })
    if (passes(out, against, min)) return out
  }
  return step < 0 ? '#000000' : '#FFFFFF'
}

/** All theme colors: the main ones as given, the helpers worked out unless set by hand. */
export function deriveColors(main: Record<MainColor, string>, current: Colors, manual: readonly DerivedColor[]): Colors {
  const { bg, surface, text, accent } = main
  const darker = relativeLuminance(text) < relativeLuminance(bg) ? text : bg
  const auto: Record<DerivedColor, string> = {
    muted: ensureContrast(mixHex(text, bg, 62), [bg, surface], AA),
    accentText: ensureContrast(accent, [bg], AA),
    onAccent: contrastRatio('#FFFFFF', accent) >= contrastRatio(darker, accent) ? '#FFFFFF' : darker.toUpperCase(),
    line: mixHex(text, bg, 12),
  }
  const pick = (k: DerivedColor) => (manual.includes(k) ? current[k] : auto[k])
  return { ...main, muted: pick('muted'), accentText: pick('accentText'), onAccent: pick('onAccent'), line: pick('line') }
}

type ColorToken = Exclude<ThemeColorToken, 'accentTint'>
export type ReadabilityIssue = {
  fg: ColorToken; bg: ColorToken; ratio: number; min: 4.5
  fix: { token: ColorToken; hex: string; verb: 'Darken' | 'Lighten' }
}

/** Text and background pairs every theme must keep readable. */
const PAIRS: readonly [ColorToken, ColorToken][] = [
  ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['accentText', 'bg'], ['onAccent', 'accent'],
]

/**
 * Pairs below 4.5:1, each with a one-click fix. Text on the accent is fixed by changing the accent
 * (the person picks that color); any other pair by changing the text color in front.
 * `manual` is accepted so callers pass the same arguments as to `deriveColors`.
 */
export function readabilityIssues(colors: Colors, manual: readonly DerivedColor[]): ReadabilityIssue[] {
  void manual
  const out: ReadabilityIssue[] = []
  for (const [fg, bg] of PAIRS) {
    const ratio = contrastRatio(colors[fg], colors[bg])
    if (ratio >= AA) continue
    const token = fg === 'onAccent' ? 'accent' : fg
    const against = fg === 'onAccent' ? [colors.onAccent] : PAIRS.filter(([f]) => f === fg).map(([, b]) => colors[b])
    const hex = ensureContrast(colors[token], against, AA)
    const verb = relativeLuminance(hex) < relativeLuminance(colors[token]) ? 'Darken' : 'Lighten'
    out.push({ fg, bg, ratio, min: AA, fix: { token, hex, verb } })
  }
  return out
}

const NAMES: Record<ColorToken, string> = {
  bg: 'Background', surface: 'Surface', text: 'Text', muted: 'Muted text', accent: 'Accent',
  accentText: 'Accent text', onAccent: 'Text on accent', accent2: 'Second accent', line: 'Lines',
}

/** e.g. "White text on Accent is 3.6:1". A failing ratio never reads as the 4.5 it needs. */
export function issueLabel(i: ReadabilityIssue, colors: Colors): string {
  const fg = i.fg === 'onAccent' && colors.onAccent.toUpperCase() === '#FFFFFF' ? 'White text' : NAMES[i.fg]
  const shown = Math.min(Math.round(i.ratio * 10) / 10, i.ratio < i.min ? i.min - 0.1 : Infinity)
  return `${fg} on ${NAMES[i.bg]} is ${shown.toFixed(1)}:1`
}
