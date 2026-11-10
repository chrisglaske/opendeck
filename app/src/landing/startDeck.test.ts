import { expect, it } from 'vitest'
import { GALLERY } from './gallery'
import { deckFromTemplate } from './startDeck'

it.each(GALLERY.map((g) => [g.name, g] as const))('%s makes a one-slide deck in its theme', (_, g) => {
  const d = deckFromTemplate(g.templateId, g.themeId)
  expect(d.slides).toHaveLength(1)
  expect(d.slides[0].layout).toBe(`builtin:${g.templateId}`)
  expect(d.theme.id).toBe(g.themeId)
})

it('refuses an unknown template or theme', () => {
  expect(() => deckFromTemplate('nope', 'opendeck')).toThrow()
  expect(() => deckFromTemplate('title', 'nope')).toThrow()
})
