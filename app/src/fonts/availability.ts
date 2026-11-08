import type { Deck, SlideElement } from '../model/types'
import { isBundled } from './catalog'

/** True when the font ships with OpenDeck or was uploaded in this browser. */
export function isFontAvailable(family: string, uploaded: ReadonlySet<string>): boolean {
  return isBundled(family) || uploaded.has(family)
}

function collect(els: readonly SlideElement[], out: Set<string>) {
  for (const e of els) {
    if (e.type === 'text' && e.fontFamily) out.add(e.fontFamily)
    else if (e.type === 'group') collect(e.children, out)
  }
}

/** Every font family the deck uses: the theme's two plus hand-set ones, sorted. */
export function fontsInUse(deck: Deck): string[] {
  const out = new Set([deck.theme.fonts.heading, deck.theme.fonts.body])
  for (const s of deck.slides) collect(s.elements, out)
  return [...out].sort((a, b) => a.localeCompare(b))
}

export function missingFamilies(families: readonly string[], uploaded: ReadonlySet<string>): string[] {
  return families.filter((f) => !isFontAvailable(f, uploaded))
}
