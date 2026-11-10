import { afterEach, expect, it } from 'vitest'
import { createDeck } from '../model/factory'
import { DECK_FILE_FORMAT, DECK_FILE_VERSION } from '../storage/deckFile'
import { createMemoryStore } from '../storage/deckStore'
import { hasDecksHint } from '../storage/visit'
import { importAndOpen } from './importDeck'

afterEach(() => { window.location.hash = '' })

const json = (data: unknown) => new File([JSON.stringify(data)], 'deck.odeck', { type: 'application/json' })

it('imports a deck file, remembers there are decks, and opens it', async () => {
  const store = createMemoryStore()
  const r = await importAndOpen(store, json({ format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION, deck: createDeck('Shared'), assets: [] }))
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(hasDecksHint()).toBe(true)
  expect(window.location.hash).toBe(`#/deck/${r.deckId}`)
  expect(await store.getDeck(r.deckId)).not.toBeNull()
})

it('rejects a file that is not a deck and leaves no hint', async () => {
  const r = await importAndOpen(createMemoryStore(), json({ hello: 'world' }))
  expect(r.ok).toBe(false)
  expect(hasDecksHint()).toBe(false)
  expect(window.location.hash).toBe('')
})
