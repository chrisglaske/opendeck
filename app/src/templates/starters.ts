/** Ready-made decks built from the built-in templates. Each is a JSON file in `./starters`. */
import { createDeck } from '../model/factory'
import type { Deck } from '../model/types'
import { builtinTemplate } from './builtins'
import { slideFromTemplate } from './instantiate'

export type StarterDeck = { id: string; name: string; slides: string[] }

const files = import.meta.glob<{ id: string; name: string; order: number; slides: string[] }>('./starters/*.json', { eager: true, import: 'default' })

export const STARTER_DECKS: readonly StarterDeck[] = Object.values(files)
  .sort((a, b) => a.order - b.order)
  .map(({ id, name, slides }) => ({ id, name, slides }))

/** A new deck named after the starter, one slide per template in order. */
export function createStarterDeck(id: string): Deck {
  const starter = STARTER_DECKS.find((s) => s.id === id)
  const deck = createDeck(starter?.name)
  if (!starter) return deck
  const slides = starter.slides.map((t) => builtinTemplate(t)).filter((t) => t !== undefined).map(slideFromTemplate)
  return slides.length ? { ...deck, slides } : deck
}
