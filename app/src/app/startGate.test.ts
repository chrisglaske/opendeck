import { expect, it } from 'vitest'
import { createDeck } from '../model/factory'
import { createMemoryStore } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { hasDecksHint, markHasDecks } from '../storage/visit'
import { v1Fixture } from '../v1/testFixtures'
import { resolveStartTarget, startTargetSync } from './startGate'

const lsFrom = (data: Record<string, string>) => ({ getItem: (k: string) => data[k] ?? null })

it('goes Home at once when the hint is set', () => {
  markHasDecks()
  expect(startTargetSync(localStorage)).toBe('home')
})

it('goes Home at once when V1 has decks to copy', () => {
  expect(startTargetSync(lsFrom(v1Fixture('edited')))).toBe('home')
})

it('stays undecided for an untouched V1 demo or empty storage', () => {
  expect(startTargetSync(lsFrom(v1Fixture('demo-untouched')))).toBeNull()
  expect(startTargetSync(lsFrom({}))).toBeNull()
})

it('goes Home when a deck is stored, and writes the hint', async () => {
  const store = createMemoryStore()
  await store.putDeck(createDeck())
  expect(await resolveStartTarget(async () => store, localStorage)).toBe('home')
  expect(hasDecksHint()).toBe(true)
})

it('shows the landing for an empty store', async () => {
  expect(await resolveStartTarget(async () => createMemoryStore(), localStorage)).toBe('landing')
  expect(hasDecksHint()).toBe(false)
})

it('shows the landing when storage fails', async () => {
  const broken = { ...createMemoryStore(), listDecks: () => Promise.reject(new Error('no')) } as DeckStore
  expect(await resolveStartTarget(async () => broken, localStorage)).toBe('landing')
  expect(await resolveStartTarget(() => Promise.reject(new Error('no')), localStorage)).toBe('landing')
})

it('shows the landing when storage never answers', async () => {
  expect(await resolveStartTarget(() => new Promise<DeckStore>(() => {}), localStorage, 50)).toBe('landing')
})
