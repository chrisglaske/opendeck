/**
 * Switching a slide to another layout. The person's content (anything with a role that isn't an
 * untouched sample) moves to the matching spot in the new layout; their own elements (no role)
 * stay exactly where they are; content the new layout has no spot for is parked beside the slide.
 */
import { parkElements } from '../model/aside'
import { coverCrop } from '../model/geometry'
import { itemKey } from '../model/roles'
import type { ImageEl, Slide, SlideElement, TextEl } from '../model/types'
import { slideFromTemplate } from './instantiate'
import { layoutRef } from './types'
import type { Template } from './types'

/** Looks up a stored picture's size; undefined when it isn't known. */
export type NaturalSize = (assetId: string) => { w: number; h: number } | undefined

const isSample = (e: SlideElement) => (e.type === 'text' || e.type === 'image') && e.sample === true
const isContent = (e: SlideElement) => !!e.role && e.role !== 'decor' && !isSample(e)
/** Only these kinds carry content into another layout's spot. */
const MOVES = new Set<SlideElement['type']>(['text', 'image', 'icon'])

function fill(spot: SlideElement, from: SlideElement, natural: NaturalSize): SlideElement {
  if (spot.type === 'text' && from.type === 'text') {
    const { sample: _s, ...rest } = spot
    const out: TextEl = { ...rest, paragraphs: structuredClone(from.paragraphs) }
    if (from.color) out.color = from.color
    if (from.size !== undefined) out.size = from.size
    if (from.fontFamily) out.fontFamily = from.fontFamily
    return out
  }
  if (spot.type === 'image' && from.type === 'image') {
    const { sample: _s, art: _a, ...rest } = spot
    const out: ImageEl = { ...rest, assetId: from.assetId }
    if (from.art) {
      out.art = from.art
      out.assetId = ''
    } else {
      const size = natural(from.assetId)
      out.crop = size ? coverCrop(size, { w: spot.w, h: spot.h }) : { ...from.crop }
    }
    return out
  }
  if (spot.type === 'icon' && from.type === 'icon') return { ...spot, name: from.name }
  return spot
}

export function switchLayout(slide: Slide, t: Template, natural: NaturalSize = () => undefined): { slide: Slide; kept: number } {
  const own = slide.elements.filter((e) => !e.role)
  // Content parked by an earlier switch comes first, in the order it sits beside the slide.
  const byParkedPlace = (a: SlideElement, b: SlideElement) => top(a) - top(b)
  const content = [
    ...slide.elements.filter((e) => isContent(e) && e.aside).sort(byParkedPlace),
    ...slide.elements.filter((e) => isContent(e) && !e.aside),
  ]
  const used = new Set<SlideElement>()

  const made = slideFromTemplate(t).elements.map((spot) => {
    if (!spot.role || spot.role === 'decor' || !MOVES.has(spot.type)) return spot
    const from = content.find((c) => !used.has(c) && c.role === spot.role && c.type === spot.type)
    if (!from) return spot
    used.add(from)
    return fill(spot, from, natural)
  })

  const left = content.filter((c) => !used.has(c)).map(({ aside: _a, ...rest }) => rest as SlideElement)
  const kept = new Set(left.map((e) => itemKey(e.role!))).size

  return {
    slide: {
      ...slide,
      elements: [...made, ...own, ...parkElements(left)],
      background: { ...structuredClone(t.slide.background), ...(slide.background.imageId ? { imageId: slide.background.imageId } : {}) },
      layout: layoutRef(t),
    },
    kept,
  }
}

const top = (e: SlideElement) => (e.type === 'line' ? Math.min(e.y1, e.y2) : e.y)
