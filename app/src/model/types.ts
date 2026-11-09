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

/**
 * Marks an element can carry when it came from a template. `role` names the content it holds
 * (see `roles.ts`) so a layout switch can move it; `aside` parks it beside the slide, where only
 * the editor shows it.
 */
type TemplateMarks = { role?: string; aside?: true }
/** Looks shared by text, shapes and images. `opacity` is 0.05–1 (absent = 1). */
type Effects = { opacity?: number; shadow?: true }

type Box = { id: string; x: number; y: number; w: number; h: number; rotation: number; locked: boolean } & TemplateMarks

/** `letterSpacing` is in em; `lineHeight` is unitless. */
export type TextEl = Box & Effects & {
  type: 'text'
  /** Still showing a template's sample text; cleared the first time it is edited. */
  sample?: true
  style: TextStyleId; paragraphs: Paragraph[]
  font?: FontRef
  /** A hand-set font family; wins over `font` and the style's role, and stays through a theme switch. */
  fontFamily?: string
  size?: number; color?: ColorRef; lineHeight?: number; letterSpacing?: number; autoFit: boolean
}
/**
 * A rounded rectangle is `shape: 'rect'` with a radius above 0. `'theme'` follows the theme's
 * corner style; a number stays as set. Ellipses ignore the radius.
 */
export type ShapeEl = Box & Effects & {
  type: 'shape'; shape: 'rect' | 'ellipse'; radius: number | 'theme'; fill: ColorRef | null; stroke: Stroke | null
  /** The side the fill fades away toward; absent = a solid fill. */
  fade?: FadeDir
}
export type FadeDir = 'up' | 'down' | 'left' | 'right'
/** A sample picture drawn in theme colors instead of a photo. */
export type SampleArt = { kind: 'photo'; variant: 0 | 1 } | { kind: 'initials'; text: string; variant: 0 | 1 }
/** `crop` is in 0..1 of the source image. With `art`, `assetId` is `''` and the art is drawn instead. */
export type ImageEl = Box & Effects & {
  type: 'image'; assetId: string; fit: 'fill' | 'fit'; crop: Rect; radius: number
  art?: SampleArt
  /** Still showing a template's sample picture; cleared when it is replaced. */
  sample?: true
}
export type IconEl = Box & { type: 'icon'; name: string; color: ColorRef; strokeWidth: number }
/** Children are in group-local, unrotated coordinates (relative to the group's x/y). */
export type GroupEl = Box & { type: 'group'; children: SlideElement[] }
export type LineEl = {
  id: string; type: 'line'; x1: number; y1: number; x2: number; y2: number; locked: boolean
  role?: string; aside?: true
  stroke: Stroke; start: 'none' | 'arrow'; end: 'none' | 'arrow'
}
/** Shows the current theme's logo, so it changes with the theme. */
export type LogoEl = Box & { type: 'logo' }
export type SlideElement = TextEl | ShapeEl | ImageEl | IconEl | LogoEl | GroupEl | LineEl
export type BoxElement = Exclude<SlideElement, LineEl>

/** `elements` are ordered bottom → top. */
/** `layout` names the template the slide came from: `builtin:<id>` or `mine:<id>`. */
export type Slide = {
  id: string; elements: SlideElement[]; background: { color: ColorRef; imageId?: string }; notes: string; hidden: boolean
  layout?: string
}
export type Deck = {
  format: 'opendeck'; version: 1; id: string; name: string; theme: Theme
  slides: Slide[]; createdAt: number; updatedAt: number
}
export type Selection = { slideId: string; ids: string[] }
