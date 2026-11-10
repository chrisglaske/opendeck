import { newId } from '../model/ids'
import type { ColorRef, LineEl, Paragraph, Rect, ShapeEl, Slide, SlideElement, TextEl, TextStyleId, ThemeColorToken } from '../model/types'

/*
 * The landing page's own slides, built from ordinary elements so the app's renderer draws them in
 * any theme. Positions follow a 1920×1080 grid with 134-unit side margins.
 */

const theme = (t: ThemeColorToken): ColorRef => ({ theme: t })
const para = (text: string, align: Paragraph['align'] = 'left'): Paragraph => ({ runs: [{ text }], align, list: 'none' })

type TextOpts = Partial<Pick<TextEl, 'size' | 'color' | 'letterSpacing' | 'opacity' | 'font'>> & { align?: Paragraph['align'] }

function text(style: TextStyleId, value: string, r: Rect, o: TextOpts = {}): TextEl {
  const { align, ...rest } = o
  return {
    id: newId(), type: 'text', ...r, rotation: 0, locked: false,
    style, paragraphs: [para(value, align)], autoFit: true, ...rest,
  }
}

function rect(r: Rect, fill: ColorRef, radius: ShapeEl['radius'], opacity?: number): ShapeEl {
  const el: ShapeEl = { id: newId(), type: 'shape', ...r, rotation: 0, locked: false, shape: 'rect', radius, fill, stroke: null }
  if (opacity !== undefined) el.opacity = opacity
  return el
}

function line(x1: number, y: number, x2: number, color: ColorRef, width: number): LineEl {
  return { id: newId(), type: 'line', x1, y1: y, x2, y2: y, locked: false, stroke: { color, width, dash: 'solid' }, start: 'none', end: 'none' }
}

const slide = (elements: SlideElement[]): Slide => ({ id: newId(), elements, background: { color: theme('bg') }, notes: '', hidden: false })

const eyebrow = (value: string, x: number, y: number) =>
  text('caption', value.toUpperCase(), { x, y, w: 700, h: 44 }, { color: theme('accentText'), letterSpacing: 0.14 })

const PANEL: Rect = { x: 1171, y: 130, w: 614, h: 820 }
const STAT_X = [134, 442, 749]
const STAT_W = 269
const STATS = [['3×', 'faster onboarding'], ['42%', 'fewer tickets'], ['12', 'new markets']] as const
const BARS = [30, 42, 50, 61, 74, 92]
const CHART = { left: 1229, right: 1727, base: 862, height: 500, gap: 23 }

/** "Ship faster, together.": a launch-plan slide with three numbers and a small bar chart. */
export function heroSlide(): Slide {
  const on = theme('onAccent')
  const barW = (CHART.right - CHART.left - CHART.gap * (BARS.length - 1)) / BARS.length
  const bars = BARS.map((pct, i) => {
    const h = Math.round((CHART.height * pct) / 100)
    const x = Math.round(CHART.left + i * (barW + CHART.gap))
    const last = i === BARS.length - 1
    const right = last ? CHART.right : Math.round(CHART.left + i * (barW + CHART.gap) + barW)
    return rect({ x, y: CHART.base - h, w: right - x, h }, last ? theme('accent2') : on, 8, last ? undefined : 0.55)
  })
  return slide([
    eyebrow('Q1 2027 · Launch plan', 134, PANEL.y),
    text('title', 'Ship faster, together.', { x: 134, y: 194, w: 902, h: 220 }, { size: 104 }),
    text('body', 'One plan for product, sales and support, and three numbers we watch every week.', { x: 134, y: 443, w: 806, h: 110 }, { size: 36, color: theme('muted') }),
    ...STATS.flatMap(([n, label], i) => {
      const x = STAT_X[i]
      return [
        line(x, 787, x + STAT_W, theme('line'), 2),
        text('heading', n, { x, y: 812, w: STAT_W, h: 84 }, { size: 77 }),
        text('caption', label, { x, y: PANEL.y + PANEL.h - 40, w: STAT_W, h: 40 }, { color: theme('muted') }),
      ]
    }),
    rect(PANEL, theme('accent'), 'theme'),
    text('caption', 'Weekly active teams', { x: 1229, y: 188, w: 498, h: 40 }, { color: on, opacity: 0.85 }),
    text('heading', '+38%', { x: 1229, y: 222, w: 498, h: 96 }, { size: 84, color: on }),
    ...bars,
    line(CHART.left, CHART.base, CHART.right, on, 2),
    text('caption', 'Jan', { x: CHART.left, y: 878, w: 120, h: 34 }, { size: 23, color: on, opacity: 0.8 }),
    text('caption', 'Jun', { x: CHART.right - 120, y: 878, w: 120, h: 34 }, { size: 23, color: on, opacity: 0.8, align: 'right' }),
  ])
}

/** Where the "Move anything" card starts, in slide units. */
export const DEMO_CARD_START: Rect = { x: 1152, y: 194, w: 576, h: 670 }

/** The "Move anything" slide without its card: the card is drawn on top so it can be dragged. */
export function demoSlide(): Slide {
  return slide([
    eyebrow('Roadmap', 134, 151),
    text('title', 'Three bets for next year', { x: 134, y: 227, w: 883, h: 210 }, { size: 96 }),
    text('body', 'Faster setup, a shared library, and offline-first sync.', { x: 134, y: 583, w: 768, h: 110 }, { size: 36, color: theme('muted') }),
  ])
}
