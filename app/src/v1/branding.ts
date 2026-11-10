/**
 * V1's deck settings as a V2 theme. V1 filled in the same defaults for everyone, so a setting
 * equal to V1's default counts as not set; a deck with nothing set uses V2's default theme.
 */
import { isBundled } from '../fonts/catalog'
import { newId } from '../model/ids'
import { OPENDECK_THEME } from '../model/theme'
import type { Theme } from '../model/theme'
import { deriveColors } from '../model/themeColors'
import { V1_DEFAULTS } from './normalize'
import type { V1Settings } from './types'

const HEX = /^#[0-9a-f]{6}$/i

/** The first family in a CSS font list: "'Playfair Display', serif" → "Playfair Display". */
function firstFamily(css: string): string {
  return (css.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '').trim()
}

/** The V2 font for V1's font setting; null when it is V1's default or a font V2 can't load. */
function v1Font(s: V1Settings): string | null {
  if (s.font === V1_DEFAULTS.font) return null
  const family = firstFamily(s.font)
  if (family === 'Roboto') return 'Inter'
  return isBundled(family) ? family : null
}

/**
 * A theme built on the default one with only V1's custom accent, font and logo changed; null
 * when none of them is set. V1 used one font for everything, so it becomes both theme fonts.
 */
export function v1Theme(s: V1Settings, logoAssetId: string | null, projectName: string): Theme | null {
  const accent = HEX.test(s.theme) && s.theme.toUpperCase() !== V1_DEFAULTS.theme.toUpperCase() ? s.theme.toUpperCase() : null
  const font = v1Font(s)
  if (!accent && !font && !logoAssetId) return null
  const base = structuredClone(OPENDECK_THEME)
  const theme: Theme = { ...base, id: newId(), name: `${projectName} theme`.slice(0, 200), source: null }
  if (accent) {
    const { muted: _m, accentText: _a, onAccent: _o, line: _l, ...main } = base.colors
    theme.colors = deriveColors({ ...main, accent }, base.colors, base.manualColors)
  }
  if (font) theme.fonts = { heading: font, body: font }
  if (logoAssetId) theme.logo = { main: logoAssetId }
  return theme
}

/** V1's present-mode header text and badge, kept for the Present stage; null when both are V1's defaults. */
export function v1Header(s: V1Settings): { text: string; badge: string } | null {
  const text = s.headerText !== V1_DEFAULTS.headerText ? s.headerText : ''
  const badge = s.headerIcon !== V1_DEFAULTS.headerIcon ? s.headerIcon : ''
  return text || badge ? { text, badge } : null
}
