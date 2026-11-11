import { describe, expect, it } from 'vitest'
import { sanitizeDeck } from '../model/sanitize'
import { builtinTemplate } from './builtins'
import type { TextEl } from '../model/types'
import { createStarterDeck, STARTER_DECKS, starterSlideTemplate } from './starters'

describe('starter decks', () => {
  it('builds the four starter decks from templates', () => {
    expect(STARTER_DECKS.map((s) => [s.name, s.slides.length])).toEqual([['Pitch deck', 10], ['Quarterly review', 9], ['Tech talk', 9], ['Workshop', 9]])
    for (const s of STARTER_DECKS) for (const slide of s.slides) expect(builtinTemplate(starterSlideTemplate(slide)), String(slide)).toBeDefined()
    const d = createStarterDeck('pitch')
    expect(d.name).toBe('Pitch deck')
    expect(d.slides.map((x) => x.layout)).toEqual(STARTER_DECKS[0].slides.map((x) => `builtin:${starterSlideTemplate(x)}`))
    expect(sanitizeDeck(JSON.parse(JSON.stringify(d)))).toMatchObject({ ok: true, repaired: 0 })
  })

  const coverTexts = (id: string) =>
    (createStarterDeck(id).slides[0].elements.filter((e) => e.type === 'text') as TextEl[])
      .map((e) => ({ h: e.h, sample: e.sample, text: e.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n') }))
  const coverTitle = (id: string) => [...coverTexts(id)].sort((a, b) => b.h - a.h)[0].text

  it("every starter's cover title is unique", () => {
    const titles = STARTER_DECKS.map((s) => coverTitle(s.id))
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('the Workshop cover talks about a workshop, as untouched sample text', () => {
    const texts = coverTexts('workshop')
    expect(texts.map((t) => t.text).slice(0, 4)).toEqual([
      'WORKSHOP · HALF DAY',
      'Design systems in practice',
      'Three hours, one shared kit, and a deck you can reuse.',
      'Northwind · Design workshop',
    ])
    expect(texts.every((t) => t.sample === true)).toBe(true)
    const d = createStarterDeck('workshop')
    expect(sanitizeDeck(JSON.parse(JSON.stringify(d)))).toMatchObject({ ok: true, repaired: 0 })
  })

  it('every starter slide comes with short sample speaker notes, and the first one says what notes are', () => {
    for (const s of STARTER_DECKS) {
      const d = createStarterDeck(s.id)
      for (const slide of d.slides) {
        expect(slide.notes.trim().length, `${s.id} slide`).toBeGreaterThan(20)
        expect(slide.notes.length, `${s.id} slide`).toBeLessThan(400)
      }
      expect(d.slides[0].notes).toMatch(/only you/i)
      expect(sanitizeDeck(JSON.parse(JSON.stringify(d)))).toMatchObject({ ok: true, repaired: 0 })
    }
  })
})

describe('sample text', () => {
  it('names no real companies', () => {
    const all = JSON.stringify(STARTER_DECKS.map((s) => createStarterDeck(s.id)))
    for (const brand of ['Stripe', 'Figma', 'tinyqueue']) expect(all).not.toContain(brand)
  })
})
