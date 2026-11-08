/** Fonts that ship with OpenDeck. Each registers as "<family> Variable" (see `fontStack` in model/theme). */
export type FontCategory = 'sans' | 'serif' | 'display' | 'mono'

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  sans: 'Sans serif', serif: 'Serif', display: 'Display', mono: 'Mono',
}

export const BUNDLED_FONTS: readonly { family: string; category: FontCategory }[] = [
  { family: 'Inter', category: 'sans' },
  { family: 'Manrope', category: 'sans' },
  { family: 'IBM Plex Sans', category: 'sans' },
  { family: 'DM Sans', category: 'sans' },
  { family: 'Inter Tight', category: 'sans' },
  { family: 'Plus Jakarta Sans', category: 'sans' },
  { family: 'Work Sans', category: 'sans' },
  { family: 'Figtree', category: 'sans' },
  { family: 'Fraunces', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Newsreader', category: 'serif' },
  { family: 'Space Grotesk', category: 'display' },
  { family: 'Outfit', category: 'display' },
  { family: 'Bricolage Grotesque', category: 'display' },
  { family: 'Playfair Display', category: 'display' },
  { family: 'Sora', category: 'display' },
  { family: 'JetBrains Mono', category: 'mono' },
]

const BUNDLED = new Set(BUNDLED_FONTS.map((f) => f.family))
export const isBundled = (family: string) => BUNDLED.has(family)
