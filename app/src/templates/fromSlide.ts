import { newId } from '../model/ids'
import { parseRole } from '../model/roles'
import type { Slide, SlideElement } from '../model/types'
import type { Template } from './types'

/** Roles can be numbered up to 99; past that an element keeps no role and stays the person's own. */
const MAX_INDEX = 99

function fresh(el: SlideElement): SlideElement {
  const copy = structuredClone(el)
  copy.id = newId()
  delete copy.aside
  if (copy.type === 'group') copy.children = copy.children.map(fresh)
  return copy
}

/**
 * A template made from a slide. Its text and pictures become sample content that the next
 * person types over; whatever had no role gets one so a later layout switch can move it.
 * Elements parked beside the slide are left out.
 */
export function templateFromSlide(slide: Slide, name: string): Template {
  const elements = slide.elements.filter((e) => !e.aside).map(fresh)
  const next = { text: 0, picture: 0 }
  for (const e of elements) {
    if (!e.role) continue
    const { base, index } = parseRole(e.role)
    if (base === 'text' || base === 'picture') next[base] = Math.max(next[base], index)
  }
  for (const e of elements) {
    if (e.type === 'text' || e.type === 'image') {
      e.sample = true
      if (e.role) continue
      const base = e.type === 'text' ? 'text' : 'picture'
      if (next[base] < MAX_INDEX) e.role = `${base}[${++next[base]}]`
    } else if (!e.role) {
      e.role = 'decor'
    }
  }
  const now = Date.now()
  return {
    id: newId(),
    name: name.trim().slice(0, 200) || 'Untitled template',
    group: 'mine',
    keywords: [],
    order: 0,
    slide: { background: structuredClone(slide.background), elements },
    createdAt: now,
    updatedAt: now,
  }
}
