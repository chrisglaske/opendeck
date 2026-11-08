import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import DeckListStub, { formatEdited } from './DeckListStub'
import { createMemoryStore } from '../storage/deckStore'
import { createDeck } from '../model/factory'

afterEach(() => { window.location.hash = '' })

async function storeWith(...names: string[]) {
  const s = createMemoryStore()
  for (const [i, n] of names.entries()) await s.putDeck({ ...createDeck(n), updatedAt: i + 1 })
  return s
}

describe('DeckListStub', () => {
  it('lists decks newest first', async () => {
    render(<DeckListStub store={await storeWith('Old', 'New')} />)
    const rows = await screen.findAllByRole('listitem')
    expect(rows.map((r) => within(r).getByRole('heading').textContent)).toEqual(['New', 'Old'])
  })

  it('shows the empty state', async () => {
    render(<DeckListStub store={createMemoryStore()} />)
    expect(await screen.findByText('No decks yet')).toBeInTheDocument()
  })

  it('New deck saves a deck and opens it', async () => {
    const store = createMemoryStore()
    render(<DeckListStub store={store} />)
    await userEvent.click((await screen.findAllByRole('button', { name: 'New deck' }))[0])
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\/.+/))
    const id = window.location.hash.slice('#/deck/'.length)
    expect(await store.getDeck(id)).not.toBeNull()
  })

  it('asks in the row before deleting', async () => {
    const store = await storeWith('Keep', 'Old pitch')
    render(<DeckListStub store={store} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Old pitch' }))
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Old pitch' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
    expect((await store.listDecks()).map((d) => d.name)).toEqual(['Keep'])
  })
})

describe('formatEdited', () => {
  const now = Date.parse('2026-11-08T12:00:00')
  it('is friendly about recent edits', () => {
    expect(formatEdited(now - 20_000, now)).toBe('Edited just now')
    expect(formatEdited(now - 5 * 60_000, now)).toBe('Edited 5 min ago')
    expect(formatEdited(now - 3 * 3600_000, now)).toBe('Edited 3 h ago')
  })
  it('uses a date for older edits', () => {
    expect(formatEdited(Date.parse('2026-10-28T09:00:00'), now)).toBe('Edited Oct 28')
  })
})
