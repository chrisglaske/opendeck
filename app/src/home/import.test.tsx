import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck } from '../model/factory'
import type { Deck } from '../model/types'
import { DECK_FILE_FORMAT, DECK_FILE_MAX_BYTES, DECK_FILE_VERSION } from '../storage/deckFile'
import { createMemoryStore } from '../storage/deckStore'
import { ToastHost } from '../ui'
import HomePage from './HomePage'
import { emptyEntry } from './library'

const saved = vi.hoisted(() => ({ calls: [] as { blob: Blob; name: string }[] }))
vi.mock('../editor/download', async (orig) => ({
  ...(await orig<typeof import('../editor/download')>()),
  saveBlob: (blob: Blob, name: string) => saved.calls.push({ blob, name }),
}))

beforeEach(() => {
  saved.calls = []
})
afterEach(() => {
  window.location.hash = ''
})

async function setup() {
  const store = createMemoryStore()
  const d = { ...createDeck('Quarterly review'), updatedAt: 1000 }
  await store.putDeck(d)
  await store.putLibrary(emptyEntry(d.id))
  render(<><HomePage route={{ view: 'home' }} store={store} /><ToastHost /></>)
  await screen.findByRole('region', { name: 'Recent' })
  return { store, deck: d }
}

const toastText = () => screen.queryAllByRole('status').map((s) => s.textContent).join(' | ')
const json = (data: unknown, name = 'deck.odeck') => new File([JSON.stringify(data)], name, { type: 'application/json' })

async function importFile(f: File) {
  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Deck file (.odeck)…' }))
  await userEvent.upload(screen.getByLabelText('Deck file'), f)
}

describe('Import menu', () => {
  it('offers a deck file', async () => {
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    const menu = screen.getByRole('menu', { name: 'Import' })
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Deck file (.odeck)…'])
  })

  it('imports a deck file as a new deck and opens it', async () => {
    const { store, deck } = await setup()
    await importFile(json({ format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION, deck: { ...deck, name: 'From a friend' }, assets: [] }))
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\/.+/))
    const id = window.location.hash.slice('#/deck/'.length)
    expect(id).not.toBe(deck.id)
    expect(((await store.getDeck(id)) as Deck).name).toBe('From a friend')
    expect(((await store.getDeck(deck.id)) as Deck).name).toBe('Quarterly review')
  })

  it('says when a file is not a deck, and changes nothing', async () => {
    const { store } = await setup()
    await importFile(new File(['hello'], 'notes.odeck'))
    await waitFor(() => expect(toastText()).toContain("This file isn't an OpenDeck deck."))
    expect(window.location.hash).toBe('')
    expect(await store.listDecks()).toHaveLength(1)
  })

  it('says when a deck was made with a newer OpenDeck', async () => {
    await setup()
    await importFile(json({ format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION + 1, deck: {} }))
    await waitFor(() => expect(toastText()).toContain('This deck was made with a newer OpenDeck.'))
  })

  it('says when a file is too large', async () => {
    await setup()
    const big = json({})
    Object.defineProperty(big, 'size', { value: DECK_FILE_MAX_BYTES + 1 })
    await importFile(big)
    await waitFor(() => expect(toastText()).toContain('This file is too large to import.'))
  })
})

describe('Export .odeck on a deck card', () => {
  it('downloads the deck as a deck file', async () => {
    const { deck } = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Quarterly review' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Export .odeck' }))
    await waitFor(() => expect(saved.calls).toHaveLength(1))
    expect(saved.calls[0].name).toBe('Quarterly review.odeck')
    const parsed = JSON.parse(await saved.calls[0].blob.text())
    expect(parsed).toMatchObject({ format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION, deck: { id: deck.id, name: 'Quarterly review' } })
  })
})
