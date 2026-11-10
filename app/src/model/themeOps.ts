import type { BrandKit } from './brandKit'
import { mixHex, relativeLuminance } from './contrast'
import { findElement, updateElements } from './ops'
import type { Theme } from './theme'
import type { ColorRef, Deck, ImageEl, Slide } from './types'

/** True when white text reads better than black on this color. */
export function isDarkHex(hex: string): boolean {
  return relativeLuminance(hex) < 0.179
}

/** The `#RRGGBB` a color reference shows with this theme. */
export function colorHex(c: ColorRef, t: Theme): string {
  if ('hex' in c) return c.hex
  if (c.theme === 'accentTint') return mixHex(t.colors.accent, t.colors.bg, 14)
  return t.colors[c.theme]
}

export function slideIsDark(slide: Slide, t: Theme): boolean {
  return isDarkHex(colorHex(slide.background.color, t))
}

/** The logo asset to show on a slide: the dark-background version on dark slides when there is one. */
export function logoAssetFor(t: Theme, slide: Slide): string | undefined {
  return slideIsDark(slide, t) ? t.logo.dark ?? t.logo.main : t.logo.main ?? t.logo.dark
}

/** Gives the deck a copy of `theme`. Elements are untouched: theme-bound values restyle, hand-set ones stay. */
export function applyTheme(deck: Deck, theme: Theme): Deck {
  return { ...deck, theme: structuredClone(theme) }
}

/** The theme a deck gets from a brand kit, remembering which kit and version it came from. */
export function themeFromKit(kit: BrandKit): Theme {
  const t = structuredClone(kit.theme)
  t.source = { kind: 'kit', id: kit.id, name: kit.theme.name, updatedAt: kit.updatedAt }
  return t
}

/** True when the deck uses this brand kit and the kit was saved again since. */
export function isKitNewer(theme: Theme, kit: BrandKit): boolean {
  return theme.source?.kind === 'kit' && theme.source.id === kit.id && kit.updatedAt > theme.source.updatedAt
}

/** Turns a logo element into a plain image of the logo it shows now, so it stops following the theme. */
export function detachLogo(deck: Deck, slideId: string, id: string): Deck {
  const slide = deck.slides.find((s) => s.id === slideId)
  const found = slide ? findElement(slide, id) : null
  if (!slide || !found || found.el.type !== 'logo') return deck
  const assetId = logoAssetFor(deck.theme, slide)
  if (!assetId) return deck
  const { x, y, w, h, rotation, locked } = found.el
  const image: ImageEl = { id, type: 'image', x, y, w, h, rotation, locked, assetId, fit: 'fit', crop: { x: 0, y: 0, w: 1, h: 1 }, radius: 0 }
  return updateElements(deck, slideId, [id], () => image)
}

/** JSON with sorted keys, so two themes compare by content rather than key order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

/** True when two themes look the same, wherever they came from. */
export function sameLook(a: Theme, b: Theme): boolean {
  return canonical({ ...a, source: null }) === canonical({ ...b, source: null })
}

/**
 * The deck's theme after hand changes: marked as customized, unless it looks exactly like
 * `original` (the theme it came from) again, in which case it simply is that theme.
 */
export function markCustomized(theme: Theme, original: Theme | undefined): Theme {
  if (!theme.source) return structuredClone(theme)
  if (original && sameLook(theme, original)) return structuredClone(original)
  return { ...structuredClone(theme), source: { ...theme.source, customized: true } }
}
