import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES } from '../model/builtinThemes'
import { createDeck, createText } from '../model/factory'
import { fontsInUse, isFontAvailable, missingFamilies } from './availability'
import { BUNDLED_FONTS, FONT_CATEGORY_LABELS, isBundled } from './catalog'

describe('bundled fonts', () => {
  it('bundles the 18 agreed fonts', () => {
    expect(BUNDLED_FONTS).toHaveLength(18)
    expect(BUNDLED_FONTS.filter((f) => f.category === 'sans').map((f) => f.family)).toEqual(
      ['Inter', 'Manrope', 'IBM Plex Sans', 'DM Sans', 'Inter Tight', 'Plus Jakarta Sans', 'Work Sans', 'Figtree'])
    expect(BUNDLED_FONTS.filter((f) => f.category === 'serif').map((f) => f.family)).toEqual(['Fraunces', 'Source Serif 4', 'Lora', 'Newsreader'])
    expect(BUNDLED_FONTS.filter((f) => f.category === 'display').map((f) => f.family)).toEqual(
      ['Space Grotesk', 'Outfit', 'Bricolage Grotesque', 'Playfair Display', 'Sora'])
    expect(BUNDLED_FONTS.filter((f) => f.category === 'mono').map((f) => f.family)).toEqual(['JetBrains Mono'])
    for (const t of BUILTIN_THEMES) {
      expect(isBundled(t.fonts.heading)).toBe(true)
      expect(isBundled(t.fonts.body)).toBe(true)
    }
    expect(isBundled('Acme Sans')).toBe(false)
    expect(FONT_CATEGORY_LABELS).toEqual({ sans: 'Sans serif', serif: 'Serif', display: 'Display', mono: 'Mono' })
  })

  it('finds fonts a deck uses that this browser lacks', () => {
    const d = createDeck()
    d.theme = { ...d.theme, fonts: { heading: 'Acme Sans', body: 'Inter' } }
    d.slides[0].elements = [{ ...createText('body'), fontFamily: 'Lora' }, { ...createText('body'), fontFamily: 'Lora' }]
    const used = fontsInUse(d)
    expect(used).toEqual(['Acme Sans', 'Inter', 'Lora'])
    expect(missingFamilies(used, new Set())).toEqual(['Acme Sans'])
    expect(missingFamilies(used, new Set(['Acme Sans']))).toEqual([])
    expect(isFontAvailable('Lora', new Set())).toBe(true)
  })

  it('finds hand-set fonts inside groups', () => {
    const d = createDeck()
    const t = { ...createText('body'), fontFamily: 'Sora' }
    d.slides[0].elements = [{ id: 'g', type: 'group', x: 0, y: 0, w: 10, h: 10, rotation: 0, locked: false, children: [t] }]
    expect(fontsInUse(d)).toContain('Sora')
  })
})
