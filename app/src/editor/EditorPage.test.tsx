import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EditorPage from './EditorPage'
import { createMemoryStore } from '../storage/deckStore'
import { createDeck } from '../model/factory'

describe('EditorPage', () => {
  it('shows a not-found state for an unknown deck', async () => {
    render(<EditorPage deckId="nope" store={createMemoryStore()} />)
    expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to decks' })).toHaveAttribute('href', '#/')
  })

  it('refuses a deck from a newer version and never writes it', async () => {
    const store = createMemoryStore()
    const d = createDeck('Future')
    const raw = { ...d, version: 99, extra: 'keep me' }
    await store.putDeck(raw as never)
    render(<EditorPage deckId={d.id} store={store} />)
    expect(await screen.findByRole('heading', { name: 'Made with a newer OpenDeck' })).toBeInTheDocument()
    expect(await store.getDeck(d.id)).toEqual(raw)
  })

  it('opens a deck', async () => {
    const store = createMemoryStore()
    const d = createDeck('Q3 Board update')
    await store.putDeck(d)
    render(<EditorPage deckId={d.id} store={store} />)
    expect(await screen.findByText('Q3 Board update')).toBeInTheDocument()
  })
})
