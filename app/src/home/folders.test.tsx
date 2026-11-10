import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck } from '../model/factory'
import { createMemoryStore } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { ToastHost } from '../ui'
import { DECK_DRAG_TYPE } from './dnd'
import HomePage from './HomePage'
import { emptyEntry, sanitizeEntry, trash } from './library'
import type { LibraryEntry } from './library'
import type { HomeRoute } from './routes'

vi.mock('../storage/deckLock', () => ({
  acquireDeckLock: async () => ({ held: true, release() {}, lost: new Promise(() => {}) }),
  isAnyDeckOpen: async () => false,
}))

afterEach(() => { window.location.hash = '' })

type Seed = { name: string; entry?: Partial<LibraryEntry>; trashed?: boolean }
const FOLDERS = [{ id: 'f1', name: 'Client work' }, { id: 'f2', name: 'Conference talks' }]

async function setup(route: HomeRoute, seeds: Seed[], folders = FOLDERS) {
  const store = createMemoryStore()
  const ids: Record<string, string> = {}
  for (const [i, s] of seeds.entries()) {
    const d = { ...createDeck(s.name), updatedAt: 1000 + i }
    await store.putDeck(d)
    ids[s.name] = d.id
    let e: LibraryEntry = { ...emptyEntry(d.id), ...s.entry }
    if (s.trashed) e = trash(e, Date.now())
    await store.putLibrary(e)
  }
  for (const [i, f] of folders.entries()) await store.putFolder({ ...f, createdAt: i })
  const view = render(<><HomePage route={route} store={store} /><ToastHost /></>)
  await screen.findByRole('navigation', { name: 'Library' })
  await waitFor(() => expect(within(nav()).getByRole('link', { name: /^All decks/ })).toBeInTheDocument())
  return { store, ids, view }
}

const entryOf = async (store: DeckStore, id: string) =>
  (await store.listLibrary()).map(sanitizeEntry).find((e) => e?.deckId === id) ?? null

const nav = () => screen.getByRole('navigation', { name: 'Library' })

/** A drag from a card, as the browser hands it to the drop target. */
function fakeTransfer() {
  const data = new Map<string, string>()
  return {
    data,
    get types() { return [...data.keys()] },
    setData: (t: string, v: string) => void data.set(t, v),
    getData: (t: string) => data.get(t) ?? '',
    effectAllowed: 'all',
    dropEffect: 'none',
    setDragImage() {},
  }
}

const cardOf = (name: string) => screen.getByRole('link', { name }).closest('li') as HTMLElement

describe('Sidebar folders', () => {
  it('lists folders with the number of decks in each, Trash not counted', async () => {
    await setup({ view: 'home' }, [
      { name: 'A', entry: { folderId: 'f1' } },
      { name: 'B', entry: { folderId: 'f1' } },
      { name: 'C', entry: { folderId: 'f1' }, trashed: true },
      { name: 'D', entry: { folderId: 'f2' } },
    ])
    expect(within(nav()).getByRole('link', { name: /^Client work/ })).toHaveTextContent('Client work2')
    expect(within(nav()).getByRole('link', { name: /^Client work/ })).toHaveAttribute('href', '#/folder/f1')
    expect(within(nav()).getByRole('link', { name: /^Conference talks/ })).toHaveTextContent('Conference talks1')
  })

  it('New folder adds "New folder" with its name field focused, and Enter saves the name', async () => {
    const { store } = await setup({ view: 'home' }, [{ name: 'A' }])
    await userEvent.click(within(nav()).getByRole('button', { name: 'New folder' }))
    const field = await within(nav()).findByRole('textbox', { name: 'Folder name' })
    expect(field).toHaveValue('New folder')
    expect(field).toHaveFocus()
    await userEvent.clear(field)
    await userEvent.type(field, 'Talks{Enter}')
    await waitFor(async () => expect((await store.listFolders()).map((f) => (f as { name: string }).name)).toContain('Talks'))
    expect(within(nav()).getByRole('link', { name: /^Talks/ })).toHaveTextContent('Talks0')
  })

  it('dropping a card on a folder moves the deck there; the folder lights up while dragged over', async () => {
    const { store, ids } = await setup({ view: 'home' }, [{ name: 'A' }])
    const dt = fakeTransfer()
    fireEvent.dragStart(within(cardOf('A')).getByRole('link', { name: 'A' }), { dataTransfer: dt })
    expect(dt.getData(DECK_DRAG_TYPE)).toBe(ids.A)
    const folder = within(nav()).getByRole('link', { name: /^Client work/ })
    fireEvent.dragEnter(folder, { dataTransfer: dt })
    fireEvent.dragOver(folder, { dataTransfer: dt })
    expect(folder).toHaveAttribute('data-drop', 'true')
    fireEvent.drop(folder, { dataTransfer: dt })
    expect(folder).not.toHaveAttribute('data-drop')
    await waitFor(async () => expect((await entryOf(store, ids.A))?.folderId).toBe('f1'))
    expect(within(nav()).getByRole('link', { name: /^Client work/ })).toHaveTextContent('Client work1')
  })

  it('dropping a card on All decks takes it out of its folder', async () => {
    const { store, ids } = await setup({ view: 'home' }, [{ name: 'A', entry: { folderId: 'f1' } }])
    const dt = fakeTransfer()
    fireEvent.dragStart(cardOf('A'), { dataTransfer: dt })
    const all = within(nav()).getByRole('link', { name: /^All decks/ })
    fireEvent.dragOver(all, { dataTransfer: dt })
    fireEvent.drop(all, { dataTransfer: dt })
    await waitFor(async () => expect((await entryOf(store, ids.A))?.folderId).toBeNull())
  })

  it('ignores drops that are not a deck', async () => {
    const { store, ids } = await setup({ view: 'home' }, [{ name: 'A' }])
    const dt = fakeTransfer()
    dt.setData('text/plain', ids.A)
    const folder = within(nav()).getByRole('link', { name: /^Client work/ })
    fireEvent.dragOver(folder, { dataTransfer: dt })
    expect(folder).not.toHaveAttribute('data-drop')
    fireEvent.drop(folder, { dataTransfer: dt })
    await act(async () => {})
    expect((await entryOf(store, ids.A))?.folderId).toBeNull()
  })
})

describe('Folder page', () => {
  it('shows the folder name, "N decks" and only its decks', async () => {
    await setup({ view: 'folder', id: 'f1' }, [
      { name: 'A', entry: { folderId: 'f1' } },
      { name: 'B' },
      { name: 'C', entry: { folderId: 'f1' } },
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'Client work' })).toBeInTheDocument()
    expect(screen.getByText('2 decks')).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).getAllByRole('listitem').map((li) => within(li).getAllByRole('link')[0].textContent)).toEqual(['C', 'A'])
  })

  it('Rename in the folder menu renames it in place', async () => {
    const { store } = await setup({ view: 'folder', id: 'f1' }, [{ name: 'A', entry: { folderId: 'f1' } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Folder actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const field = screen.getByRole('textbox', { name: 'Folder name' })
    expect(field).toHaveFocus()
    await userEvent.clear(field)
    await userEvent.type(field, 'Clients{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument()
    await waitFor(async () => expect((await store.listFolders()).map((f) => (f as { name: string }).name)).toContain('Clients'))
  })

  it('Delete folder keeps its decks, with no folder, and goes to All decks', async () => {
    const { store, ids } = await setup({ view: 'folder', id: 'f1' }, [{ name: 'A', entry: { folderId: 'f1' } }])
    await userEvent.click(await screen.findByRole('button', { name: 'Folder actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete folder' }))
    await waitFor(() => expect(window.location.hash).toBe('#/all'))
    expect((await store.listFolders()).map((f) => (f as { id: string }).id)).not.toContain('f1')
    expect((await entryOf(store, ids.A))?.folderId).toBeNull()
    expect(await store.getDeck(ids.A)).not.toBeNull()
  })

  it('a folder that does not exist shows a short note', async () => {
    await setup({ view: 'folder', id: 'gone' }, [{ name: 'A' }])
    expect(await screen.findByText('This folder no longer exists.')).toBeInTheDocument()
  })
})

describe('All decks', () => {
  it('shows every live deck, newest first, with its folder chip before its tags', async () => {
    await setup({ view: 'all' }, [
      { name: 'A', entry: { folderId: 'f1', tags: ['sales'] } },
      { name: 'B', trashed: true },
      { name: 'C', entry: { tags: ['q4'] } },
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'All decks' })).toBeInTheDocument()
    expect(screen.getByText('2 decks · newest first')).toBeInTheDocument()
    const main = screen.getByRole('main')
    const cards = within(main).getAllByRole('listitem')
    expect(cards.map((li) => within(li).getAllByRole('link')[0].textContent)).toEqual(['C', 'A'])
    const chips = cards[1].querySelectorAll('[data-chip]')
    expect([...chips].map((c) => c.textContent)).toEqual(['Client work', 'sales'])
    expect(chips[0]).toHaveAttribute('data-chip', 'folder')
  })

  it('a tag view shows only decks with that tag and a removable filter chip', async () => {
    await setup({ view: 'tag', tag: 'Sales' }, [
      { name: 'A', entry: { tags: ['sales'] } },
      { name: 'B', entry: { tags: ['q4'] } },
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'All decks' })).toBeInTheDocument()
    expect(screen.getByText('1 deck · newest first')).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).getAllByRole('listitem').map((li) => within(li).getAllByRole('link')[0].textContent)).toEqual(['A'])
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter' }))
    expect(window.location.hash).toBe('#/all')
  })
})

describe('Sidebar tags', () => {
  it('shows the 6 most used tags as links, then "Show all N tags" that expands in place', async () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    await setup({ view: 'home' }, [
      { name: 'A', entry: { tags } },
      { name: 'B', entry: { tags: ['h', 'g'] } },
    ])
    const region = within(nav()).getByRole('list', { name: 'Tags' })
    const shown = () => within(region).getAllByRole('link').map((a) => a.textContent)
    expect(shown()).toEqual(['g', 'h', 'a', 'b', 'c', 'd'])
    expect(within(region).getByRole('link', { name: 'g' })).toHaveAttribute('href', '#/tag/g')
    await userEvent.click(within(nav()).getByRole('button', { name: 'Show all 8 tags' }))
    expect(shown()).toHaveLength(8)
    expect(within(nav()).queryByRole('button', { name: /Show all/ })).toBeNull()
  })

  it('has no Tags section when no deck has tags', async () => {
    await setup({ view: 'home' }, [{ name: 'A' }])
    expect(within(nav()).queryByRole('list', { name: 'Tags' })).toBeNull()
  })
})
