import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck } from '../model/factory'
import { createMemoryStore } from '../storage/deckStore'
import { ToastHost } from '../ui'
import HomePage from './HomePage'
import { emptyEntry, sanitizeEntry, TRASH_MS } from './library'
import type { LibraryEntry } from './library'

const openElsewhere = new Set<string>()
vi.mock('../storage/deckLock', () => ({
  acquireDeckLock: async (id: string) => (openElsewhere.has(id) ? { held: false } : { held: true, release() {}, lost: new Promise(() => {}) }),
  isAnyDeckOpen: async () => openElsewhere.size > 0,
}))

beforeEach(() => openElsewhere.clear())
afterEach(() => { window.location.hash = '' })

const DAY = 24 * 3600_000
type Seed = { name: string; entry?: Partial<LibraryEntry>; trashedDaysAgo?: number }

async function setup(seeds: Seed[], folders: { id: string; name: string }[] = []) {
  const store = createMemoryStore()
  const ids: Record<string, string> = {}
  for (const [i, s] of seeds.entries()) {
    const d = { ...createDeck(s.name), updatedAt: 1000 + i }
    await store.putDeck(d)
    ids[s.name] = d.id
    const e: LibraryEntry = { ...emptyEntry(d.id), ...s.entry }
    if (s.trashedDaysAgo !== undefined) {
      e.trashedAt = Date.now() - s.trashedDaysAgo * DAY
      e.restore = { folderId: e.folderId, pinnedAt: null }
    }
    await store.putLibrary(e)
  }
  for (const [i, f] of folders.entries()) await store.putFolder({ ...f, createdAt: i })
  render(<><HomePage route={{ view: 'trash' }} store={store} /><ToastHost /></>)
  await screen.findByRole('heading', { level: 1, name: 'Trash' })
  return { store, ids }
}

const entryOf = async (store: ReturnType<typeof createMemoryStore>, id: string) =>
  (await store.listLibrary()).map(sanitizeEntry).find((e) => e?.deckId === id) ?? null
const card = (name: string) => screen.getByText(name, { selector: '[data-deck-name]' }).closest('li') as HTMLElement

describe('Trash page', () => {
  it('lists trashed decks, most recently trashed first, with the count, Empty trash and the 30-day note', async () => {
    await setup([
      { name: 'Live' },
      { name: 'Old', trashedDaysAgo: 28 },
      { name: 'New', trashedDaysAgo: 2 },
    ])
    expect(screen.getByText('2 decks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empty trash' })).toBeInTheDocument()
    expect(screen.getByText('Decks in Trash are deleted for good 30 days after you move them here.')).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).getAllByRole('listitem').map((li) => li.querySelector('[data-deck-name]')?.textContent)).toEqual(['New', 'Old'])
    expect(within(main).queryByText('Live')).toBeNull()
  })

  it('shows days left, red from 3 days, "1 day left" singular', async () => {
    await setup([
      { name: 'A', trashedDaysAgo: 2 },
      { name: 'B', trashedDaysAgo: 27.5 },
      { name: 'C', trashedDaysAgo: 29.5 },
    ])
    expect(within(card('A')).getByText('28 days left')).not.toHaveAttribute('data-soon')
    expect(within(card('B')).getByText('3 days left')).toHaveAttribute('data-soon', 'true')
    expect(within(card('C')).getByText('1 day left')).toHaveAttribute('data-soon', 'true')
  })

  it('a deck trashed after Home opened shows 30 days left, not 31', async () => {
    const store = createMemoryStore()
    const d = createDeck('Later')
    await store.putDeck(d)
    await store.putLibrary(emptyEntry(d.id))
    const { rerender } = render(<><HomePage route={{ view: 'home' }} store={store} /><ToastHost /></>)
    await screen.findByText('Later', { selector: '[data-deck-name]' })
    const opened = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(opened + 3 * 3600_000)
    try {
      await userEvent.click(within(card('Later')).getByRole('button', { name: 'More actions for Later' }))
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Trash' }))
      await waitFor(async () => expect((await entryOf(store, d.id))?.trashedAt).not.toBeNull())
      rerender(<><HomePage route={{ view: 'trash' }} store={store} /><ToastHost /></>)
      expect(await within(await waitFor(() => card('Later'))).findByText('30 days left')).toBeInTheDocument()
    } finally {
      clock.mockRestore()
    }
  })

  it('a trashed card does not open the deck', async () => {
    await setup([{ name: 'A', trashedDaysAgo: 1 }])
    expect(within(card('A')).queryByRole('link')).toBeNull()
  })

  it('Restore puts the deck back in its folder', async () => {
    const { store, ids } = await setup([{ name: 'A', entry: { folderId: 'f1' }, trashedDaysAgo: 1 }], [{ id: 'f1', name: 'Work' }])
    await userEvent.click(within(card('A')).getByRole('button', { name: 'Restore' }))
    await waitFor(async () => expect((await entryOf(store, ids.A))?.trashedAt).toBeNull())
    expect((await entryOf(store, ids.A))?.folderId).toBe('f1')
    expect(screen.queryByText('A', { selector: '[data-deck-name]' })).toBeNull()
  })

  it('Delete for good asks first, then deletes the deck', async () => {
    const { store, ids } = await setup([{ name: 'A', trashedDaysAgo: 1 }, { name: 'B', trashedDaysAgo: 1 }])
    await userEvent.click(within(card('A')).getByRole('button', { name: 'Delete for good' }))
    const dlg = screen.getByRole('dialog', { name: 'Delete “A” for good?' })
    expect(within(dlg).getByText("This can't be undone.")).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel' }))
    expect(await store.getDeck(ids.A)).not.toBeNull()
    await userEvent.click(within(card('A')).getByRole('button', { name: 'Delete for good' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete for good' }))
    await waitFor(async () => expect(await store.getDeck(ids.A)).toBeNull())
    expect(await store.getDeck(ids.B)).not.toBeNull()
    await waitFor(() => expect(screen.queryByText('A', { selector: '[data-deck-name]' })).toBeNull())
  })

  it('Empty trash asks first, then deletes every trashed deck', async () => {
    const { store, ids } = await setup([{ name: 'Live' }, { name: 'A', trashedDaysAgo: 1 }, { name: 'B', trashedDaysAgo: 3 }])
    await userEvent.click(screen.getByRole('button', { name: 'Empty trash' }))
    const dlg = screen.getByRole('dialog', { name: 'Empty trash?' })
    expect(within(dlg).getByText("2 decks will be deleted for good, with their pictures. This can't be undone.")).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Empty trash' }))
    await waitFor(async () => expect(await store.getDeck(ids.A)).toBeNull())
    expect(await store.getDeck(ids.B)).toBeNull()
    expect(await store.getDeck(ids.Live)).not.toBeNull()
    expect(await screen.findByText('Trash is empty')).toBeInTheDocument()
  })

  it('keeps decks that are open in another tab and says so', async () => {
    const { store, ids } = await setup([{ name: 'A', trashedDaysAgo: 1 }, { name: 'B', trashedDaysAgo: 1 }])
    openElsewhere.add(ids.A)
    await userEvent.click(screen.getByRole('button', { name: 'Empty trash' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Empty trash' }))
    expect(await screen.findByText('1 deck is open in another tab and was kept.')).toBeInTheDocument()
    expect(await store.getDeck(ids.A)).not.toBeNull()
    expect(await store.getDeck(ids.B)).toBeNull()
  })

  it('shows the empty state', async () => {
    await setup([{ name: 'Live' }])
    expect(screen.getByText('Empty')).toBeInTheDocument()
    expect(screen.getByText('Trash is empty')).toBeInTheDocument()
    expect(screen.getByText('Decks you delete wait here for 30 days, so you can restore them.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Empty trash' })).toBeNull()
  })

  it('a deck due for clean-up is gone when Trash opens', async () => {
    const store = createMemoryStore()
    const d = createDeck('Expired')
    await store.putDeck(d)
    await store.putLibrary({ ...emptyEntry(d.id), trashedAt: Date.now() - TRASH_MS - 1 })
    render(<HomePage route={{ view: 'trash' }} store={store} />)
    expect(await screen.findByText('Trash is empty')).toBeInTheDocument()
  })
})
