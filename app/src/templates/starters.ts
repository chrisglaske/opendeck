/** Ready-made decks built from the built-in templates. Each is a JSON file in `./starters`. */
import { createDeck } from '../model/factory'
import type { Deck, Slide, SlideElement } from '../model/types'
import { builtinTemplate } from './builtins'
import { slideFromTemplate } from './instantiate'

/**
 * A starter slide: a built-in template id, or a template whose text boxes get their own sample
 * text (in document order; boxes past the end keep the template's text).
 */
export type StarterSlide = string | { template: string; texts: string[] }
export type StarterDeck = { id: string; name: string; slides: StarterSlide[] }

const files = import.meta.glob<{ id: string; name: string; order: number; slides: StarterSlide[] }>('./starters/*.json', { eager: true, import: 'default' })

export const STARTER_DECKS: readonly StarterDeck[] = Object.values(files)
  .sort((a, b) => a.order - b.order)
  .map(({ id, name, slides }) => ({ id, name, slides }))

export const starterSlideTemplate = (s: StarterSlide): string => (typeof s === 'string' ? s : s.template)

/** Puts `texts` into the slide's text boxes in order, keeping each box's look and its sample mark. */
function withTexts(slide: Slide, texts: readonly string[]): Slide {
  let i = 0
  const fill = (el: SlideElement): SlideElement => {
    if (el.type === 'group') return { ...el, children: el.children.map(fill) }
    if (el.type !== 'text' || i >= texts.length) return el
    const text = texts[i++]
    const [first] = el.paragraphs
    const [run] = first?.runs ?? []
    return { ...el, paragraphs: [{ ...first, runs: [{ ...run, text }] }] }
  }
  return { ...slide, elements: slide.elements.map(fill) }
}

/** A new deck named after the starter, one slide per template in order. */
export function createStarterDeck(id: string): Deck {
  const starter = STARTER_DECKS.find((s) => s.id === id)
  const deck = createDeck(starter?.name)
  if (!starter) return deck
  const slides = starter.slides.flatMap((s) => {
    const t = builtinTemplate(starterSlideTemplate(s))
    if (!t) return []
    const slide = slideFromTemplate(t)
    return [typeof s === 'string' ? slide : withTexts(slide, s.texts)]
  })
  return slides.length ? { ...deck, slides } : deck
}
