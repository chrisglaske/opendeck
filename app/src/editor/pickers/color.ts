import type { ColorRef, Deck, SlideElement, ThemeColorToken } from '../../model/types'

/** Names shown for theme colors, in picker order. */
export const THEME_COLORS: { token: ThemeColorToken; name: string }[] = [
  { token: 'text', name: 'Text' },
  { token: 'muted', name: 'Muted text' },
  { token: 'accent', name: 'Accent' },
  { token: 'accentText', name: 'Accent text' },
  { token: 'accent2', name: 'Second accent' },
  { token: 'accentTint', name: 'Accent tint' },
  { token: 'onAccent', name: 'On accent' },
  { token: 'surface', name: 'Surface' },
  { token: 'line', name: 'Line' },
  { token: 'bg', name: 'Background' },
]

export const themeColorName = (t: ThemeColorToken) => THEME_COLORS.find((c) => c.token === t)?.name ?? t

/** How many custom colors the picker offers. */
export const MAX_CUSTOM = 10

/** Reads `#RGB` or `#RRGGBB` (the # is optional) as upper-case `#RRGGBB`, or null. */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return `#${h.toUpperCase()}`
}

export type Hsv = { h: number; s: number; v: number }

export function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (k: number) => {
    const x = (k + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1))
  }
  const byte = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0')
  return `#${byte(f(5))}${byte(f(3))}${byte(f(1))}`.toUpperCase()
}

function elementColors(el: SlideElement, out: ColorRef[]) {
  switch (el.type) {
    case 'text':
      if (el.color) out.push(el.color)
      for (const p of el.paragraphs) for (const r of p.runs) if (r.color) out.push(r.color)
      break
    case 'shape':
      if (el.fill) out.push(el.fill)
      if (el.stroke) out.push(el.stroke.color)
      break
    case 'line':
      out.push(el.stroke.color)
      break
    case 'icon':
      out.push(el.color)
      break
    case 'group':
      for (const c of el.children) elementColors(c, out)
      break
  }
}

/** Custom (hex) colors used in the deck, most recently added element first, without repeats. */
export function customColors(deck: Deck): string[] {
  // One group per slide background and per element; newer groups come first.
  const groups: ColorRef[][] = []
  for (const s of deck.slides) {
    groups.push([s.background.color])
    for (const el of s.elements) {
      const g: ColorRef[] = []
      elementColors(el, g)
      groups.push(g)
    }
  }
  const out: string[] = []
  for (const c of groups.reverse().flat()) {
    if (!('hex' in c)) continue
    const hex = c.hex.toUpperCase()
    if (!out.includes(hex)) out.push(hex)
    if (out.length === MAX_CUSTOM) break
  }
  return out
}
