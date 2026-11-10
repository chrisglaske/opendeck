import { newId } from './ids'
import { OPENDECK_THEME } from './theme'
import { DECK_VERSION, SLIDE_H, SLIDE_W } from './types'
import type { Deck, IconEl, ImageEl, LineEl, LogoEl, Point, ShapeEl, Slide, TextEl, TextStyleId } from './types'

export function createSlide(): Slide {
  return { id: newId(), elements: [], background: { color: { theme: 'bg' } }, notes: '', hidden: false }
}

export function createDeck(name = 'Untitled deck'): Deck {
  const now = Date.now()
  return {
    format: 'opendeck', version: DECK_VERSION, id: newId(), name,
    theme: structuredClone(OPENDECK_THEME), slides: [createSlide()], transition: 'fade', createdAt: now, updatedAt: now,
  }
}

/** Top-left for a w×h box: centered on `at`, or on the slide when `at` is missing. */
function place(w: number, h: number, at?: Point): Point {
  const c = at ?? { x: SLIDE_W / 2, y: SLIDE_H / 2 }
  return { x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2) }
}

const TEXT_DEFAULTS: Record<TextStyleId, { w: number; h: number; text: string }> = {
  title: { w: 1200, h: 140, text: 'Add a title' },
  heading: { w: 1000, h: 90, text: 'Add a heading' },
  body: { w: 800, h: 120, text: 'Add some text' },
  caption: { w: 600, h: 60, text: 'Add a caption' },
}

export function createText(style: TextStyleId, at?: Point): TextEl {
  const d = TEXT_DEFAULTS[style]
  return {
    id: newId(), type: 'text', ...place(d.w, d.h, at), w: d.w, h: d.h, rotation: 0, locked: false,
    style, paragraphs: [{ runs: [{ text: d.text }], align: 'left', list: 'none' }], autoFit: true,
  }
}

export function createShape(shape: 'rect' | 'ellipse', at?: Point): ShapeEl {
  return {
    id: newId(), type: 'shape', ...place(400, 400, at), w: 400, h: 400, rotation: 0, locked: false,
    shape, radius: shape === 'rect' ? 'theme' : 0, fill: { theme: 'surface' }, stroke: null,
  }
}

export function createLine(at?: Point): LineEl {
  const p = place(400, 0, at)
  return {
    id: newId(), type: 'line', x1: p.x, y1: p.y, x2: p.x + 400, y2: p.y, locked: false,
    stroke: { color: { theme: 'text' }, width: 4, dash: 'solid' }, start: 'none', end: 'none',
  }
}

export function createImage(assetId: string, natural: { w: number; h: number }): ImageEl {
  const s = Math.min(1, 960 / Math.max(1, natural.w), 540 / Math.max(1, natural.h))
  const w = Math.max(1, Math.round(natural.w * s)), h = Math.max(1, Math.round(natural.h * s))
  return {
    id: newId(), type: 'image', ...place(w, h), w, h, rotation: 0, locked: false,
    assetId, fit: 'fill', crop: { x: 0, y: 0, w: 1, h: 1 }, radius: 0,
  }
}

export function createIcon(name: string): IconEl {
  return {
    id: newId(), type: 'icon', ...place(160, 160), w: 160, h: 160, rotation: 0, locked: false,
    name, color: { theme: 'accent' }, strokeWidth: 1.75,
  }
}

/** A logo box in the top-left corner; it shows whatever logo the theme has. */
export function createLogo(): LogoEl {
  return { id: newId(), type: 'logo', x: 134, y: 97, w: 320, h: 120, rotation: 0, locked: false }
}
