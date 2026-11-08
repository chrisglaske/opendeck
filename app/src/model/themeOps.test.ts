import { describe, expect, it } from 'vitest'
import { createEditorStore } from '../editor/store'
import type { BrandKit } from './brandKit'
import { builtinTheme } from './builtinThemes'
import { createDeck, createLogo, createShape, createSlide, createText } from './factory'
import { SAMPLE_SLIDES } from './sampleSlides'
import { OPENDECK_THEME, radiusPx, textStyleOf } from './theme'
import type { Theme } from './theme'
import { applyTheme, detachLogo, isDarkHex, isKitNewer, logoAssetFor, slideIsDark, themeFromKit } from './themeOps'
import type { ColorRef, ShapeEl, Slide, SlideElement, TextEl } from './types'

const swiss = builtinTheme('swiss')!

function kit(over: Partial<BrandKit> = {}): BrandKit {
  const theme: Theme = { ...structuredClone(OPENDECK_THEME), id: 'k1', name: 'Acme Co.', source: null }
  return { id: 'k1', theme, createdAt: 1, updatedAt: 9, ...over }
}

describe('applyTheme', () => {
  it('switching the theme restyles theme-bound values and keeps hand-set ones', () => {
    const d = createDeck()
    const text: TextEl = { ...createText('body'), color: { hex: '#0F7B6C' }, fontFamily: 'Lora' }
    const themed: ShapeEl = { ...createShape('rect'), radius: 'theme' }
    const hand: ShapeEl = { ...createShape('rect'), radius: 12 }
    d.slides[0].elements = [text, themed, hand]
    const before = structuredClone(d.slides)
    const out = applyTheme(d, swiss)
    expect(out.slides).toEqual(before)
    expect(out.theme).toEqual(swiss)
    expect(out.theme).not.toBe(swiss)
    expect(radiusPx(themed.radius, out.theme)).toBe(0)
    expect(radiusPx(hand.radius, out.theme)).toBe(12)
    expect(textStyleOf(text, out.theme).color).toBe('#0F7B6C')
    expect(textStyleOf(text, out.theme).fontFamily).toContain('Lora')
  })

  it('applyTheme in the store is one undo step that restores the exact theme', () => {
    const d = createDeck()
    d.theme = { ...d.theme, logo: { main: 'a1', dark: 'a2' }, manualColors: ['muted'], radius: 46, source: { kind: 'kit', id: 'k1', name: 'Acme', updatedAt: 5 } }
    const original = structuredClone(d.theme)
    const store = createEditorStore(d)
    store.apply((x) => applyTheme(x, swiss))
    expect(store.getState().deck.theme.source?.id).toBe('swiss')
    store.undo()
    expect(store.getState().deck.theme).toEqual(original)
    expect(store.getState().canUndo).toBe(false)
  })
})

describe('brand kit themes', () => {
  it('a kit theme records where it came from', () => {
    const t = themeFromKit(kit())
    expect(t.source).toEqual({ kind: 'kit', id: 'k1', name: 'Acme Co.', updatedAt: 9 })
    expect(t.name).toBe('Acme Co.')
  })
  it('detects a newer brand kit', () => {
    const theme = { ...OPENDECK_THEME, source: { kind: 'kit' as const, id: 'k1', name: 'Acme Co.', updatedAt: 5 } }
    expect(isKitNewer(theme, kit())).toBe(true)
    expect(isKitNewer(theme, kit({ updatedAt: 5 }))).toBe(false)
    expect(isKitNewer(theme, kit({ id: 'k2' }))).toBe(false)
    expect(isKitNewer(OPENDECK_THEME, kit())).toBe(false)
  })
})

describe('logos', () => {
  const dark: Slide = { ...createSlide(), background: { color: { hex: '#0E1320' } } }
  const light = createSlide()
  it('tells dark colors from light ones', () => {
    expect(isDarkHex('#0E1320')).toBe(true)
    expect(isDarkHex('#FCFBF8')).toBe(false)
    expect(slideIsDark(dark, OPENDECK_THEME)).toBe(true)
    expect(slideIsDark({ ...light, background: { color: { theme: 'accentTint' } } }, OPENDECK_THEME)).toBe(false)
    expect(slideIsDark(light, builtinTheme('midnight')!)).toBe(true)
  })
  it('picks the logo for light and dark slides', () => {
    const both = { ...OPENDECK_THEME, logo: { main: 'm', dark: 'd' } }
    const mainOnly = { ...OPENDECK_THEME, logo: { main: 'm' } }
    const darkOnly = { ...OPENDECK_THEME, logo: { dark: 'd' } }
    expect(logoAssetFor(both, light)).toBe('m')
    expect(logoAssetFor(both, dark)).toBe('d')
    expect(logoAssetFor(mainOnly, dark)).toBe('m')
    expect(logoAssetFor(darkOnly, light)).toBe('d')
    expect(logoAssetFor(OPENDECK_THEME, light)).toBeUndefined()
  })
  it('detaches a logo into a normal image', () => {
    const d = createDeck()
    const logo = { ...createLogo(), rotation: 10 }
    d.slides[0].elements = [logo]
    d.theme = { ...d.theme, logo: { main: 'a1' } }
    const out = detachLogo(d, d.slides[0].id, logo.id)
    expect(out.slides[0].elements[0]).toEqual({
      id: logo.id, type: 'image', x: logo.x, y: logo.y, w: logo.w, h: logo.h, rotation: 10, locked: false,
      assetId: 'a1', fit: 'fit', crop: { x: 0, y: 0, w: 1, h: 1 }, radius: 0,
    })
    const none = createDeck()
    none.slides[0].elements = [logo]
    expect(detachLogo(none, none.slides[0].id, logo.id)).toBe(none)
  })
})

describe('sample slides', () => {
  function colors(els: SlideElement[], out: ColorRef[] = []): ColorRef[] {
    for (const e of els) {
      if (e.type === 'text') {
        if (e.color) out.push(e.color)
        for (const p of e.paragraphs) for (const r of p.runs) if (r.color) out.push(r.color)
      } else if (e.type === 'shape') {
        if (e.fill) out.push(e.fill)
        if (e.stroke) out.push(e.stroke.color)
      } else if (e.type === 'line') out.push(e.stroke.color)
      else if (e.type === 'icon') out.push(e.color)
      else if (e.type === 'group') colors(e.children, out)
    }
    return out
  }
  it('sample slides only use theme colors', () => {
    for (const s of Object.values(SAMPLE_SLIDES)) {
      for (const c of [s.background.color, ...colors(s.elements)]) expect('theme' in c).toBe(true)
    }
  })
  it('have fixed ids and each carries a logo box', () => {
    expect(Object.values(SAMPLE_SLIDES).map((s) => s.id)).toEqual(['sample-title', 'sample-bullets', 'sample-stats'])
    for (const s of Object.values(SAMPLE_SLIDES)) expect(s.elements.some((e) => e.type === 'logo')).toBe(true)
  })
})
