import { newId } from '../model/ids'
import type { Deck, Slide, SlideElement } from '../model/types'
import { addSlide } from '../model/ops'
import { layoutRef } from './types'
import type { Template } from './types'

function fresh(el: SlideElement): SlideElement {
  const copy = structuredClone(el)
  copy.id = newId()
  if (copy.type === 'group') copy.children = copy.children.map(fresh)
  return copy
}

/** A new slide made from a template: fresh ids at every depth, sample marks and roles kept. */
export function slideFromTemplate(t: Template): Slide {
  return {
    id: newId(),
    elements: t.slide.elements.map(fresh),
    background: structuredClone(t.slide.background),
    notes: '',
    hidden: false,
    layout: layoutRef(t),
  }
}

/** Adds a slide from a template (or a blank one for `null`) after `afterId`, or at the end. */
export function addSlideFromTemplate(d: Deck, afterId: string | null, t: Template | null): { deck: Deck; slideId: string } {
  if (!t) return addSlide(d, afterId)
  const s = slideFromTemplate(t)
  const i = afterId === null ? -1 : d.slides.findIndex((x) => x.id === afterId)
  const at = i < 0 ? d.slides.length : i + 1
  return { deck: { ...d, slides: [...d.slides.slice(0, at), s, ...d.slides.slice(at)] }, slideId: s.id }
}
