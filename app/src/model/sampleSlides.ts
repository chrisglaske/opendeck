/**
 * Fixed sample slides used to show what a theme looks like (theme cards, the brand kit preview).
 * They only use theme colors, so they restyle with whatever theme they are drawn with.
 */
import type { ColorRef, LineEl, LogoEl, Paragraph, ShapeEl, Slide, SlideElement, TextEl, TextStyleId, ThemeColorToken } from './types'

type At = { x: number; y: number; w: number; h: number }
const theme = (t: ThemeColorToken): ColorRef => ({ theme: t })
const para = (text: string, align: Paragraph['align'] = 'left', list: Paragraph['list'] = 'none'): Paragraph => ({ runs: [{ text }], align, list })

function text(id: string, style: TextStyleId, at: At, paragraphs: Paragraph[], over: Partial<TextEl> = {}): TextEl {
  return { id, type: 'text', ...at, rotation: 0, locked: false, style, paragraphs, autoFit: false, ...over }
}
function rect(id: string, at: At, fill: ThemeColorToken, rotation = 0, shape: ShapeEl['shape'] = 'rect'): ShapeEl {
  return { id, type: 'shape', ...at, rotation, locked: false, shape, radius: shape === 'rect' ? 'theme' : 0, fill: theme(fill), stroke: null }
}
function logo(id: string, at: At): LogoEl {
  return { id, type: 'logo', ...at, rotation: 0, locked: false }
}
function slide(id: string, elements: SlideElement[]): Slide {
  return { id, elements, background: { color: theme('bg') }, notes: '', hidden: false }
}

const rule: LineEl = {
  id: 'st-rule', type: 'line', x1: 134, y1: 983, x2: 1786, y2: 983, locked: false,
  stroke: { color: theme('line'), width: 2, dash: 'solid' }, start: 'none', end: 'none',
}

const title = slide('sample-title', [
  logo('st-logo', { x: 134, y: 97, w: 320, h: 59 }),
  text('st-over', 'caption', { x: 134, y: 262, w: 900, h: 40 }, [para('Q3 2026 · PRODUCT TEAM')], { color: theme('accentText'), letterSpacing: 0.14 }),
  text('st-title', 'title', { x: 134, y: 340, w: 1075, h: 240 }, [para('Quarterly review')]),
  text('st-body', 'body', { x: 134, y: 650, w: 883, h: 130 }, [para('What we shipped, what we learned, and where we go next.')], { color: theme('muted') }),
  rect('st-back', { x: 1344, y: 238, w: 403, h: 497 }, 'accent2', 7),
  rect('st-front', { x: 1287, y: 281, w: 403, h: 497 }, 'accent', 355),
  rule,
  text('st-site', 'caption', { x: 134, y: 1000, w: 600, h: 40 }, [para('opendeck.work')], { color: theme('muted') }),
  text('st-page', 'caption', { x: 1586, y: 1000, w: 200, h: 40 }, [para('01', 'right')], { color: theme('muted') }),
])

const bullets = slide('sample-bullets', [
  text('sb-head', 'heading', { x: 134, y: 130, w: 845, h: 90 }, [para('What we shipped')]),
  text('sb-list', 'body', { x: 134, y: 367, w: 845, h: 320 }, [
    para('Free-form editor with snapping', 'left', 'bullet'),
    para('Themes that restyle every slide', 'left', 'bullet'),
    para('Save any slide as a template', 'left', 'bullet'),
  ]),
  rect('sb-panel', { x: 1075, y: 130, w: 730, h: 821 }, 'surface'),
  rect('sb-dot', { x: 1206, y: 278, w: 117, h: 117 }, 'accent2', 0, 'ellipse'),
  rect('sb-block', { x: 1206, y: 560, w: 300, h: 300 }, 'accent'),
  rect('sb-block2', { x: 1430, y: 640, w: 300, h: 220 }, 'text'),
  logo('sb-logo', { x: 1485, y: 988, w: 320, h: 49 }),
])

function stat(n: number, x: number, value: string, label: string): SlideElement[] {
  return [
    rect(`ss-card${n}`, { x, y: 410, w: 499, h: 475 }, 'surface'),
    text(`ss-value${n}`, 'title', { x: x + 46, y: 452, w: 420, h: 130 }, [para(value)], { size: 104, color: theme('accentText') }),
    text(`ss-label${n}`, 'body', { x: x + 46, y: 790, w: 420, h: 60 }, [para(label)], { size: 32, color: theme('muted') }),
  ]
}

const stats = slide('sample-stats', [
  text('ss-head', 'heading', { x: 134, y: 130, w: 1200, h: 90 }, [para('Revenue grew 32%')]),
  ...stat(1, 134, '42k', 'decks created this quarter'),
  ...stat(2, 710, '3 min', 'median time to first slide'),
  ...stat(3, 1286, '98%', 'of V1 decks converted'),
  logo('ss-logo', { x: 1466, y: 135, w: 320, h: 54 }),
])

export const SAMPLE_SLIDES: { title: Slide; bullets: Slide; stats: Slide } = { title, bullets, stats }
