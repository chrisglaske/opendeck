import { expect, it } from 'vitest'
import { HAS_DECKS_KEY, hasDecksHint, markHasDecks } from './visit'

const throwing = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('blocked') },
} as unknown as Storage

it('remembers that this browser has decks', () => {
  expect(hasDecksHint()).toBe(false)
  markHasDecks()
  expect(hasDecksHint()).toBe(true)
  expect(localStorage.getItem(HAS_DECKS_KEY)).toBe('1')
})

it('treats blocked storage as no hint and never throws', () => {
  expect(hasDecksHint(throwing)).toBe(false)
  expect(() => markHasDecks(throwing)).not.toThrow()
})
