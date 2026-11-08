import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EditorPage from './EditorPage'
import { createMemoryStore, createSessionOnlyStore } from '../storage/deckStore'
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

  it('with storage blocked, a deck shows Not saved from the start', async () => {
    const store = createSessionOnlyStore()
    const d = createDeck('Private window')
    await store.putDeck(d).catch(() => {})
    render(<EditorPage deckId={d.id} store={store} />)
    expect(await screen.findByText('Private window')).toBeInTheDocument()
    expect(await screen.findByText('Not saved')).toBeInTheDocument()
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('asks before leaving only while changes are not saved', async () => {
    const leave = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }
    const ok = createMemoryStore()
    const d = createDeck('Fine')
    await ok.putDeck(d)
    const view = render(<EditorPage deckId={d.id} store={ok} />)
    expect(await screen.findByText('Fine')).toBeInTheDocument()
    expect(leave()).toBe(false)
    view.unmount()

    const blocked = createSessionOnlyStore()
    const e = createDeck('Blocked')
    await blocked.putDeck(e).catch(() => {})
    render(<EditorPage deckId={e.id} store={blocked} />)
    expect(await screen.findByText('Not saved')).toBeInTheDocument()
    expect(leave()).toBe(true)
  })

  it('opens a deck', async () => {
    const store = createMemoryStore()
    const d = createDeck('Q3 Board update')
    await store.putDeck(d)
    render(<EditorPage deckId={d.id} store={store} />)
    expect(await screen.findByText('Q3 Board update')).toBeInTheDocument()
  })
})
