import { describe, expect, it } from 'vitest'
import { sanitizeDeck } from '../model/sanitize'
import { builtinTemplate } from './builtins'
import { createStarterDeck, STARTER_DECKS } from './starters'

describe('starter decks', () => {
  it('builds the four starter decks from templates', () => {
    expect(STARTER_DECKS.map((s) => [s.name, s.slides.length])).toEqual([['Pitch deck', 10], ['Quarterly review', 9], ['Tech talk', 9], ['Workshop', 9]])
    for (const s of STARTER_DECKS) for (const id of s.slides) expect(builtinTemplate(id), id).toBeDefined()
    const d = createStarterDeck('pitch')
    expect(d.name).toBe('Pitch deck')
    expect(d.slides.map((x) => x.layout)).toEqual(STARTER_DECKS[0].slides.map((id) => `builtin:${id}`))
    expect(sanitizeDeck(JSON.parse(JSON.stringify(d)))).toMatchObject({ ok: true, repaired: 0 })
  })
})
