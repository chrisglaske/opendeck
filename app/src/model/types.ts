import type { Theme } from './theme'

/** Logical slide size. Every stored position, size and font size uses these units. */
export const SLIDE_W = 1920
export const SLIDE_H = 1080
export const DECK_VERSION = 1

export type Rect = { x: number; y: number; w: number; h: number }
export type Point = { x: number; y: number }

export type ThemeColorToken =
  | 'bg' | 'surface' | 'text' | 'muted' | 'accent' | 'accentText' | 'onAccent' | 'accent2' | 'line' | 'accentTint'
export const THEME_COLOR_TOKENS: readonly ThemeColorToken[] = [
  'bg', 'surface', 'text', 'muted', 'accent', 'accentText', 'onAccent', 'accent2', 'line', 'accentTint',
]

/** A theme color follows the theme; a hex color (`#RRGGBB`) stays as set. */
export type ColorRef = { theme: ThemeColorToken } | { hex: string }
export type TextStyleId = 'title' | 'heading' | 'body' | 'caption'
export type FontRef = 'heading' | 'body'

export type Run = { text: string; bold?: true; italic?: true; underline?: true; color?: ColorRef; size?: number; href?: string }
export type Paragraph = { runs: Run[]; align: 'left' | 'center' | 'right'; list: 'none' | 'bullet' }
export type Stroke = { color: ColorRef; width: number; dash: 'solid' | 'dashed' }

export type MainColor = 'bg' | 'surface' | 'text' | 'accent' | 'accent2'
/** Colors worked out from the main ones unless the person sets them by hand. */
export type DerivedColor = 'muted' | 'accentText' | 'onAccent' | 'line'

type Box = { id: string; x: number; y: number; w: number; h: number; rotation: number; locked: boolean }

/** `letterSpacing` is in em; `lineHeight` is unitless. */
export type TextEl = Box & {
  type: 'text'; style: TextStyleId; paragraphs: Paragraph[]
  font?: FontRef
  /** A hand-set font family; wins over `font` and the style's role, and stays through a theme switch. */
  fontFamily?: string
  size?: number; color?: ColorRef; lineHeight?: number; letterSpacing?: number; autoFit: boolean
}
/**
 * A rounded rectangle is `shape: 'rect'` with a radius above 0. `'theme'` follows the theme's
 * corner style; a number stays as set. Ellipses ignore the radius.
 */
export type ShapeEl = Box & { type: 'shape'; shape: 'rect' | 'ellipse'; radius: number | 'theme'; fill: ColorRef | null; stroke: Stroke | null }
/** `crop` is in 0..1 of the source image. */
export type ImageEl = Box & { type: 'image'; assetId: string; fit: 'fill' | 'fit'; crop: Rect; radius: number }
export type IconEl = Box & { type: 'icon'; name: string; color: ColorRef; strokeWidth: number }
/** Children are in group-local, unrotated coordinates (relative to the group's x/y). */
export type GroupEl = Box & { type: 'group'; children: SlideElement[] }
export type LineEl = {
  id: string; type: 'line'; x1: number; y1: number; x2: number; y2: number; locked: boolean
  stroke: Stroke; start: 'none' | 'arrow'; end: 'none' | 'arrow'
}
/** Shows the current theme's logo, so it changes with the theme. */
export type LogoEl = Box & { type: 'logo' }
export type SlideElement = TextEl | ShapeEl | ImageEl | IconEl | LogoEl | GroupEl | LineEl
export type BoxElement = Exclude<SlideElement, LineEl>

/** `elements` are ordered bottom → top. */
export type Slide = { id: string; elements: SlideElement[]; background: { color: ColorRef; imageId?: string }; notes: string; hidden: boolean }
export type Deck = {
  format: 'opendeck'; version: 1; id: string; name: string; theme: Theme
  slides: Slide[]; createdAt: number; updatedAt: number
}
export type Selection = { slideId: string; ids: string[] }
