import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyEntry, sanitizeEntry, trash } from '../home/library'
import { postTrashed } from '../home/libraryChannel'
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

  it('opening a deck copied from V1 clears its From V1 mark', async () => {
    const store = createMemoryStore()
    const d = createDeck('From the old days')
    await store.putDeck(d)
    await store.putLibrary({ ...emptyEntry(d.id), v1Id: 'proj_1', fromV1Unopened: true })
    render(<EditorPage deckId={d.id} store={store} />)
    expect(await screen.findByText('From the old days')).toBeInTheDocument()
    await waitFor(async () => {
      const e = (await store.listLibrary()).map(sanitizeEntry).find((x) => x?.deckId === d.id)
      expect(e?.fromV1Unopened).toBeUndefined()
      expect(e?.v1Id).toBe('proj_1')
    })
  })

  describe('a deck in the Trash', () => {
    afterEach(() => { window.location.hash = '' })

    it('shows the Trash screen instead of the editor; Back to Home goes home', async () => {
      const store = createMemoryStore()
      const d = createDeck('Old pitch')
      await store.putDeck(d)
      await store.putLibrary(trash(emptyEntry(d.id), Date.now()))
      render(<EditorPage deckId={d.id} store={store} />)
      expect(await screen.findByRole('heading', { name: 'This deck is in the Trash' })).toBeInTheDocument()
      expect(screen.getByText('Restore it to keep working on it.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '#/')
    })

    it('Restore takes it out of the Trash, back in its folder, and opens the editor', async () => {
      const store = createMemoryStore()
      const d = createDeck('Old pitch')
      await store.putDeck(d)
      await store.putFolder({ id: 'f1', name: 'Work', createdAt: 0 })
      await store.putLibrary(trash({ ...emptyEntry(d.id), folderId: 'f1' }, Date.now()))
      render(<EditorPage deckId={d.id} store={store} />)
      await userEvent.click(await screen.findByRole('button', { name: 'Restore' }))
      expect(await screen.findByRole('button', { name: 'Rename deck' })).toHaveTextContent('Old pitch')
      const e = (await store.listLibrary()).map(sanitizeEntry).find((x) => x?.deckId === d.id)
      expect(e?.trashedAt).toBeNull()
      expect(e?.folderId).toBe('f1')
    })

    it('when another tab moves the open deck to the Trash, the pending save is kept and the Trash screen shows', async () => {
      const store = createMemoryStore()
      const d = createDeck('Live')
      await store.putDeck(d)
      render(<EditorPage deckId={d.id} store={store} />)
      await userEvent.click(await screen.findByRole('button', { name: 'Rename deck' }))
      await userEvent.clear(screen.getByRole('textbox', { name: 'Deck name' }))
      await userEvent.type(screen.getByRole('textbox', { name: 'Deck name' }), 'Renamed{Enter}')
      await store.putLibrary(trash(emptyEntry(d.id), Date.now()))
      postTrashed(d.id)
      expect(await screen.findByRole('heading', { name: 'This deck is in the Trash' })).toBeInTheDocument()
      await waitFor(async () => expect(((await store.getDeck(d.id)) as { name: string }).name).toBe('Renamed'))
    })

    it('ignores the Trash message for another deck', async () => {
      const store = createMemoryStore()
      const d = createDeck('Live')
      await store.putDeck(d)
      render(<EditorPage deckId={d.id} store={store} />)
      await screen.findByRole('button', { name: 'Rename deck' })
      postTrashed('someone-else')
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByRole('heading', { name: 'This deck is in the Trash' })).toBeNull()
    })
  })
})
