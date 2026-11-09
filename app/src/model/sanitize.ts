/**
 * The only way foreign data (storage, imports, clipboard) becomes a Deck.
 * Every field is checked and copied into a fresh object; raw input is never
 * spread, so unknown keys can't ride along. Problems are fixed with defaults
 * and counted in `repaired`.
 */
import { childToParent, MIN_SIZE } from './geometry'
import { newId } from './ids'
import { OPENDECK_THEME } from './theme'
import type { Theme, ThemeSource, ThemeTextStyle } from './theme'
import { createSlide } from './factory'
import { ROLE } from './roles'
import { DECK_VERSION, THEME_COLOR_TOKENS, TRANSITIONS } from './types'
import type {
  ColorRef, Deck, DerivedColor, FadeDir, GroupEl, IconEl, ImageEl, LineEl, Paragraph, Rect, Run, ShapeEl, Slide, SlideElement, Stroke,
  LogoEl, SampleArt, TextEl, TextStyleId, ThemeColorToken,
} from './types'

export type SanitizeResult = { ok: true; deck: Deck; repaired: number } | { ok: false; reason: 'not-a-deck' | 'newer-version' }

export const LIMITS = {
  coord: 100000,
  size: 100000,
  fontMin: 4,
  fontMax: 1000,
  text: 100000,
  name: 200,
  notes: 100000,
  href: 2000,
  /** Groups deeper than this are flattened into their parent. */
  groupDepth: 8,
  /** Beyond this, nested input is dropped outright (protects the call stack). */
  hardDepth: 64,
  slides: 1000,
  elements: 5000,
  paragraphs: 5000,
  runs: 5000,
} as const

const TEXT_STYLES: readonly TextStyleId[] = ['title', 'heading', 'body', 'caption']
const DERIVED_COLORS: readonly DerivedColor[] = ['muted', 'accentText', 'onAccent', 'line']
const HEX = /^#[0-9a-f]{6}$/i
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const ICON_NAME = /^[a-z0-9-]{1,64}$/
const FONT_NAME = /^[A-Za-z0-9 ._-]{1,64}$/
const LAYOUT_REF = /^(builtin|mine):[A-Za-z0-9_-]{1,64}$/
const INITIALS = /^[\p{L}\p{N}]{1,3}$/u
const SAFE_HREF = /^(https?:\/\/|mailto:)[^\s\u0000-\u001f\u007f]+$/i

/** True for the only link targets OpenDeck allows: http(s) and mailto. */
export function isSafeHref(v: string): boolean {
  return v.length <= LIMITS.href && SAFE_HREF.test(v)
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

class Ctx {
  repaired = 0
  private ids = new Set<string>()
  fix() { this.repaired++ }

  num(v: unknown, def: number, min: number, max: number): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) { this.fix(); return def }
    if (v < min) { this.fix(); return min }
    if (v > max) { this.fix(); return max }
    return v
  }
  bool(v: unknown, def: boolean): boolean {
    if (typeof v !== 'boolean') { this.fix(); return def }
    return v
  }
  str(v: unknown, def: string, max: number): string {
    if (typeof v !== 'string') { this.fix(); return def }
    if (v.length > max) { this.fix(); return v.slice(0, max) }
    return v
  }
  oneOf<T extends string>(v: unknown, list: readonly T[], def: T): T {
    if (typeof v === 'string' && (list as readonly string[]).includes(v)) return v as T
    this.fix()
    return def
  }
  /** A unique id: keeps a valid unused one, otherwise makes a new one. */
  id(v: unknown): string {
    if (typeof v === 'string' && SAFE_ID.test(v) && !this.ids.has(v)) {
      this.ids.add(v)
      return v
    }
    this.fix()
    const id = newId()
    this.ids.add(id)
    return id
  }
  coord(v: unknown) { return this.num(v, 0, -LIMITS.coord, LIMITS.coord) }
  size(v: unknown) { return this.num(v, MIN_SIZE, MIN_SIZE, LIMITS.size) }
  rotation(v: unknown) {
    const r = this.num(v, 0, -LIMITS.coord, LIMITS.coord)
    return ((r % 360) + 360) % 360
  }
  /** `undefined` when missing or invalid (invalid counts as a repair). */
  colorOpt(v: unknown): ColorRef | undefined {
    if (v === undefined) return undefined
    if (isObj(v)) {
      if (typeof v.theme === 'string' && (THEME_COLOR_TOKENS as readonly string[]).includes(v.theme)) {
        return { theme: v.theme as ThemeColorToken }
      }
      if (typeof v.hex === 'string' && HEX.test(v.hex)) return { hex: v.hex }
    }
    this.fix()
    return undefined
  }
  color(v: unknown, def: ColorRef): ColorRef {
    if (v === undefined) { this.fix(); return def }
    return this.colorOpt(v) ?? def
  }
}

function sanitizeStroke(c: Ctx, v: unknown, def: Stroke): Stroke {
  if (!isObj(v)) { c.fix(); return def }
  return { color: c.color(v.color, def.color), width: c.num(v.width, def.width, 0.5, 200), dash: c.oneOf(v.dash, ['solid', 'dashed'], 'solid') }
}

function sanitizeHref(c: Ctx, v: unknown): string | undefined {
  if (v === undefined) return undefined
  if (typeof v === 'string' && v.length <= LIMITS.href && SAFE_HREF.test(v)) return v
  c.fix()
  return undefined
}

function sanitizeRun(c: Ctx, v: unknown): Run | null {
  if (!isObj(v)) { c.fix(); return null }
  const run: Run = { text: c.str(v.text, '', LIMITS.text) }
  for (const mark of ['bold', 'italic', 'underline'] as const) {
    if (v[mark] === true) run[mark] = true
    else if (v[mark] !== undefined) c.fix()
  }
  const color = c.colorOpt(v.color)
  if (color) run.color = color
  if (v.size !== undefined) run.size = c.num(v.size, 40, LIMITS.fontMin, LIMITS.fontMax)
  const href = sanitizeHref(c, v.href)
  if (href) run.href = href
  return run
}

function sanitizeParagraph(c: Ctx, v: unknown): Paragraph | null {
  if (!isObj(v)) { c.fix(); return null }
  let runs: Run[] = []
  if (Array.isArray(v.runs)) {
    if (v.runs.length > LIMITS.runs) c.fix()
    runs = v.runs.slice(0, LIMITS.runs).map((r) => sanitizeRun(c, r)).filter((r): r is Run => r !== null)
  } else c.fix()
  if (runs.length === 0) runs = [{ text: '' }]
  return { runs, align: c.oneOf(v.align, ['left', 'center', 'right'], 'left'), list: c.oneOf(v.list, ['none', 'bullet'], 'none') }
}

function sanitizeCrop(c: Ctx, v: unknown): Rect {
  if (!isObj(v)) { c.fix(); return { x: 0, y: 0, w: 1, h: 1 } }
  const x = c.num(v.x, 0, 0, 0.99), y = c.num(v.y, 0, 0, 0.99)
  const w = c.num(v.w, 1 - x, 0.01, 1 - x), h = c.num(v.h, 1 - y, 0.01, 1 - y)
  return { x, y, w, h }
}

/** `undefined` when missing; a bad value is dropped and counted. */
function optTrue(c: Ctx, v: unknown): true | undefined {
  if (v === undefined) return undefined
  if (v === true) return true
  c.fix()
  return undefined
}

function sanitizeArt(v: unknown): SampleArt | null {
  if (!isObj(v) || (v.variant !== 0 && v.variant !== 1)) return null
  if (v.kind === 'photo') return { kind: 'photo', variant: v.variant }
  if (v.kind === 'initials' && typeof v.text === 'string' && INITIALS.test(v.text)) return { kind: 'initials', text: v.text, variant: v.variant }
  return null
}

/** Template marks every element can carry: missing is fine, invalid is a repair. */
function marks(c: Ctx, v: Obj): { role?: string; aside?: true } {
  const out: { role?: string; aside?: true } = {}
  if (v.role !== undefined) {
    if (typeof v.role === 'string' && ROLE.test(v.role)) out.role = v.role
    else c.fix()
  }
  if (optTrue(c, v.aside)) out.aside = true
  return out
}

/** Opacity and shadow for text, shapes and images. Full opacity is stored as no opacity. */
function effects(c: Ctx, v: Obj): { opacity?: number; shadow?: true } {
  const out: { opacity?: number; shadow?: true } = {}
  if (v.opacity !== undefined) {
    const o = c.num(v.opacity, 1, 0.05, 1)
    if (o < 1) out.opacity = o
  }
  if (optTrue(c, v.shadow)) out.shadow = true
  return out
}

/**
 * Cleans one element. `depth` is the group nesting level of its parent list.
 * Returns a list: usually one element, several when a too-deep group is
 * flattened, none when the element is dropped.
 */
function sanitizeElement(c: Ctx, v: unknown, depth: number): SlideElement[] {
  if (!isObj(v)) { c.fix(); return [] }
  const type = v.type
  if (type === 'line') {
    const el: LineEl = {
      id: c.id(v.id), type: 'line',
      x1: c.coord(v.x1), y1: c.coord(v.y1), x2: c.coord(v.x2), y2: c.coord(v.y2),
      locked: c.bool(v.locked, false),
      stroke: sanitizeStroke(c, v.stroke, { color: { theme: 'text' }, width: 4, dash: 'solid' }),
      start: c.oneOf(v.start, ['none', 'arrow'], 'none'), end: c.oneOf(v.end, ['none', 'arrow'], 'none'),
      ...marks(c, v),
    }
    return [el]
  }
  if (!['text', 'shape', 'image', 'icon', 'logo', 'group'].includes(type as string)) { c.fix(); return [] }
  const art = type === 'image' && v.art !== undefined ? sanitizeArt(v.art) : null
  if (type === 'image' && v.art !== undefined && !art) { c.fix(); return [] }
  if (type === 'image' && !art && (typeof v.assetId !== 'string' || !SAFE_ID.test(v.assetId))) { c.fix(); return [] }

  const box = {
    id: c.id(v.id), x: c.coord(v.x), y: c.coord(v.y), w: c.size(v.w), h: c.size(v.h),
    rotation: c.rotation(v.rotation), locked: c.bool(v.locked, false), ...marks(c, v),
  }
  switch (type) {
    case 'text': {
      let paragraphs: Paragraph[] = []
      if (Array.isArray(v.paragraphs)) {
        if (v.paragraphs.length > LIMITS.paragraphs) c.fix()
        paragraphs = v.paragraphs.slice(0, LIMITS.paragraphs).map((p) => sanitizeParagraph(c, p)).filter((p): p is Paragraph => p !== null)
      } else c.fix()
      if (paragraphs.length === 0) paragraphs = [{ runs: [{ text: '' }], align: 'left', list: 'none' }]
      const el: TextEl = { ...box, type: 'text', style: c.oneOf(v.style, TEXT_STYLES, 'body'), paragraphs, autoFit: c.bool(v.autoFit, true) }
      if (v.font !== undefined) {
        const font = c.oneOf<'heading' | 'body' | ''>(v.font, ['heading', 'body'], '')
        if (font) el.font = font
      }
      if (v.fontFamily !== undefined) {
        if (typeof v.fontFamily === 'string' && FONT_NAME.test(v.fontFamily)) el.fontFamily = v.fontFamily
        else c.fix()
      }
      if (v.size !== undefined) el.size = c.num(v.size, 40, LIMITS.fontMin, LIMITS.fontMax)
      const color = c.colorOpt(v.color)
      if (color) el.color = color
      if (v.lineHeight !== undefined) el.lineHeight = c.num(v.lineHeight, 1.2, 0.5, 4)
      if (v.letterSpacing !== undefined) el.letterSpacing = c.num(v.letterSpacing, 0, -0.5, 1)
      if (optTrue(c, v.sample)) el.sample = true
      return [Object.assign(el, effects(c, v))]
    }
    case 'shape': {
      const el: ShapeEl = {
        ...box, type: 'shape', shape: c.oneOf(v.shape, ['rect', 'ellipse'], 'rect'),
        radius: v.radius === 'theme' ? 'theme' : c.num(v.radius, 0, 0, LIMITS.size),
        fill: v.fill === null ? null : c.color(v.fill, { theme: 'surface' }),
        stroke: v.stroke === null ? null : sanitizeStroke(c, v.stroke, { color: { theme: 'text' }, width: 4, dash: 'solid' }),
        ...effects(c, v),
      }
      if (v.fade !== undefined) {
        const fade = c.oneOf<FadeDir | ''>(v.fade, ['up', 'down', 'left', 'right'], '')
        if (fade) el.fade = fade
      }
      return [el]
    }
    case 'image': {
      const el: ImageEl = {
        ...box, type: 'image', assetId: art ? '' : (v.assetId as string), fit: c.oneOf(v.fit, ['fill', 'fit'], 'fill'),
        crop: sanitizeCrop(c, v.crop), radius: c.num(v.radius, 0, 0, LIMITS.size), ...effects(c, v),
      }
      if (art) el.art = art
      if (optTrue(c, v.sample)) el.sample = true
      return [el]
    }
    case 'icon': {
      const name = typeof v.name === 'string' && ICON_NAME.test(v.name) ? v.name : (c.fix(), 'circle')
      const el: IconEl = { ...box, type: 'icon', name, color: c.color(v.color, { theme: 'accent' }), strokeWidth: c.num(v.strokeWidth, 1.75, 0.25, 10) }
      return [el]
    }
    case 'logo': {
      const el: LogoEl = { ...box, type: 'logo' }
      return [el]
    }
    default: { // group
      if (depth >= LIMITS.hardDepth) { c.fix(); return [] }
      const children = sanitizeList(c, v.children, depth + 1)
      if (children.length === 0) { c.fix(); return [] }
      const group: GroupEl = { ...box, type: 'group', children }
      if (depth >= LIMITS.groupDepth) {
        // Too deep: lift the children into this level, keeping their world position.
        c.fix()
        return children.map((ch) => childToParent(ch, group))
      }
      return [group]
    }
  }
}

function sanitizeList(c: Ctx, v: unknown, depth: number): SlideElement[] {
  if (!Array.isArray(v)) { c.fix(); return [] }
  if (v.length > LIMITS.elements) c.fix()
  return v.slice(0, LIMITS.elements).flatMap((e) => sanitizeElement(c, e, depth))
}

function sanitizeSlide(c: Ctx, v: unknown): Slide | null {
  if (!isObj(v)) { c.fix(); return null }
  const background = sanitizeBackground(c, v.background)
  const slide: Slide = {
    id: c.id(v.id),
    elements: sanitizeList(c, v.elements, 0),
    background,
    notes: c.str(v.notes, '', LIMITS.notes),
    hidden: c.bool(v.hidden, false),
  }
  if (v.layout !== undefined) {
    if (typeof v.layout === 'string' && LAYOUT_REF.test(v.layout)) slide.layout = v.layout
    else c.fix()
  }
  return slide
}

function sanitizeBackground(c: Ctx, v: unknown): Slide['background'] {
  const bg = isObj(v) ? v : (c.fix(), {} as Obj)
  const background: Slide['background'] = { color: c.color(bg.color, { theme: 'bg' }) }
  if (bg.imageId !== undefined) {
    if (typeof bg.imageId === 'string' && SAFE_ID.test(bg.imageId)) background.imageId = bg.imageId
    else c.fix()
  }
  return background
}

/** Theme fields added after decks were first saved: missing is fine, invalid is a repair. */
function sanitizeLogo(c: Ctx, v: unknown): Theme['logo'] {
  if (v === undefined) return {}
  if (!isObj(v)) { c.fix(); return {} }
  const out: Theme['logo'] = {}
  for (const k of ['main', 'dark'] as const) {
    if (v[k] === undefined) continue
    if (typeof v[k] === 'string' && SAFE_ID.test(v[k])) out[k] = v[k]
    else c.fix()
  }
  return out
}

function sanitizeManualColors(c: Ctx, v: unknown): DerivedColor[] {
  if (v === undefined) return []
  if (!Array.isArray(v)) { c.fix(); return [] }
  const out: DerivedColor[] = []
  for (const k of v) {
    if ((DERIVED_COLORS as readonly unknown[]).includes(k) && !out.includes(k as DerivedColor)) out.push(k as DerivedColor)
    else c.fix()
  }
  return out
}

function sanitizeSource(c: Ctx, v: unknown): ThemeSource | null {
  if (v === undefined || v === null) return null
  if (
    isObj(v) && (v.kind === 'builtin' || v.kind === 'kit') && typeof v.id === 'string' && SAFE_ID.test(v.id)
    && typeof v.name === 'string' && v.name.length <= LIMITS.name
    && typeof v.updatedAt === 'number' && Number.isFinite(v.updatedAt) && v.updatedAt >= 0
  ) {
    const source: ThemeSource = { kind: v.kind, id: v.id, name: v.name, updatedAt: v.updatedAt }
    if (v.customized === true) source.customized = true
    else if (v.customized !== undefined) c.fix()
    return source
  }
  c.fix()
  return null
}

function cleanTheme(c: Ctx, v: unknown): Theme {
  const d = OPENDECK_THEME
  if (!isObj(v)) { c.fix(); return structuredClone(d) }
  const colorsIn = isObj(v.colors) ? v.colors : (c.fix(), {} as Obj)
  const colors = {} as Theme['colors']
  for (const k of Object.keys(d.colors) as (keyof Theme['colors'])[]) {
    const val = colorsIn[k]
    if (typeof val === 'string' && HEX.test(val)) colors[k] = val
    else { c.fix(); colors[k] = d.colors[k] }
  }
  const fontsIn = isObj(v.fonts) ? v.fonts : (c.fix(), {} as Obj)
  const font = (val: unknown, def: string) => (typeof val === 'string' && FONT_NAME.test(val) ? val : (c.fix(), def))
  const textIn = isObj(v.text) ? v.text : (c.fix(), {} as Obj)
  const text = {} as Theme['text']
  for (const id of TEXT_STYLES) {
    const s = isObj(textIn[id]) ? (textIn[id] as Obj) : (c.fix(), {} as Obj)
    const def: ThemeTextStyle = d.text[id]
    text[id] = {
      font: c.oneOf(s.font, ['heading', 'body'], def.font),
      size: c.num(s.size, def.size, LIMITS.fontMin, LIMITS.fontMax),
      weight: c.num(s.weight, def.weight, 100, 900),
      lineHeight: c.num(s.lineHeight, def.lineHeight, 0.5, 4),
      letterSpacing: c.num(s.letterSpacing, def.letterSpacing, -0.5, 1),
    }
  }
  return {
    id: typeof v.id === 'string' && SAFE_ID.test(v.id) ? v.id : (c.fix(), d.id),
    name: c.str(v.name, d.name, LIMITS.name),
    colors,
    fonts: { heading: font(fontsIn.heading, d.fonts.heading), body: font(fontsIn.body, d.fonts.body) },
    radius: c.num(v.radius, d.radius, 0, 540),
    text,
    logo: sanitizeLogo(c, v.logo),
    manualColors: sanitizeManualColors(c, v.manualColors),
    source: sanitizeSource(c, v.source),
  }
}

export function sanitizeDeck(raw: unknown): SanitizeResult {
  if (!isObj(raw) || raw.format !== 'opendeck') return { ok: false, reason: 'not-a-deck' }
  if (typeof raw.version === 'number' && raw.version > DECK_VERSION) return { ok: false, reason: 'newer-version' }
  const c = new Ctx()
  if (raw.version !== DECK_VERSION) c.fix()
  let slides: Slide[] = []
  if (Array.isArray(raw.slides)) {
    if (raw.slides.length > LIMITS.slides) c.fix()
    slides = raw.slides.slice(0, LIMITS.slides).map((s) => sanitizeSlide(c, s)).filter((s): s is Slide => s !== null)
  } else c.fix()
  if (slides.length === 0) { c.fix(); slides = [createSlide()] }
  const now = Date.now()
  const deck: Deck = {
    format: 'opendeck',
    version: DECK_VERSION,
    id: c.id(raw.id),
    name: c.str(raw.name, 'Untitled deck', LIMITS.name),
    theme: cleanTheme(c, raw.theme),
    slides,
    // Decks saved before transitions existed simply get the default; that isn't a repair.
    transition: raw.transition === undefined ? 'fade' : c.oneOf(raw.transition, TRANSITIONS, 'fade'),
    createdAt: c.num(raw.createdAt, now, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: c.num(raw.updatedAt, now, 0, Number.MAX_SAFE_INTEGER),
  }
  return { ok: true, deck, repaired: c.repaired }
}

/** Cleans a theme from outside (e.g. a brand kit). Anything invalid falls back to the OpenDeck theme's value. */
export function sanitizeTheme(raw: unknown): Theme {
  return cleanTheme(new Ctx(), raw)
}

/** Cleans a list of elements from outside (e.g. the clipboard). Ids are unique within the list. */
export function sanitizeElements(raw: unknown): SlideElement[] {
  if (!Array.isArray(raw)) return []
  return sanitizeList(new Ctx(), raw, 0)
}

/** Cleans one slide's elements and background from outside (e.g. a template), with its own repair count. */
export function sanitizeSlideContent(raw: unknown): { elements: SlideElement[]; background: Slide['background']; repaired: number } {
  const c = new Ctx()
  const v = isObj(raw) ? raw : (c.fix(), {} as Obj)
  const elements = sanitizeList(c, v.elements, 0)
  const background = sanitizeBackground(c, v.background)
  return { elements, background, repaired: c.repaired }
}
