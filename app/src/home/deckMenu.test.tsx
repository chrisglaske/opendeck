import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck } from '../model/factory'
import type { Deck } from '../model/types'
import { createMemoryStore } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { ToastHost } from '../ui'
import { takeShowRequest } from '../present/startRequest'
import HomePage from './HomePage'
import { emptyEntry, sanitizeEntry, UNDO_MS } from './library'
import type { LibraryEntry } from './library'

const openElsewhere = new Set<string>()
vi.mock('../storage/deckLock', () => ({
  acquireDeckLock: async (id: string) => (openElsewhere.has(id) ? { held: false } : { held: true, release() {}, lost: new Promise(() => {}) }),
  isAnyDeckOpen: async () => openElsewhere.size > 0,
}))

beforeEach(() => openElsewhere.clear())
afterEach(() => {
  window.location.hash = ''
  vi.useRealTimers()
})

type Seed = { name: string; entry?: Partial<LibraryEntry> }

async function setup(seeds: Seed[], folders: { id: string; name: string }[] = []) {
  const store = createMemoryStore()
  const ids: Record<string, string> = {}
  for (const [i, s] of seeds.entries()) {
    const d = { ...createDeck(s.name), updatedAt: 1000 + i }
    await store.putDeck(d)
    ids[s.name] = d.id
    await store.putLibrary({ ...emptyEntry(d.id), ...s.entry })
  }
  for (const [i, f] of folders.entries()) await store.putFolder({ ...f, createdAt: i })
  render(<><HomePage route={{ view: 'home' }} store={store} /><ToastHost /></>)
  await screen.findByRole('region', { name: 'Recent' })
  return { store, ids }
}

const card = (name: string) => screen.getAllByRole('listitem').find((li) => within(li).queryByRole('link', { name }))!
const openMenu = async (name: string) => {
  await userEvent.click(within(card(name)).getByRole('button', { name: `More actions for ${name}` }))
  return screen.getByRole('menu', { name: `Actions for ${name}` })
}
const entryOf = async (store: DeckStore, id: string) =>
  ((await store.listLibrary()).map(sanitizeEntry).find((e) => e?.deckId === id)) ?? emptyEntry(id)
const rowsOf = (menu: HTMLElement) => [...menu.querySelectorAll('[role^="menuitem"]')].map((r) => r.textContent)
const toastText = () => screen.queryAllByRole('status').map((s) => s.textContent).join(' | ')

describe('deck menu', () => {
  it('lists the actions in order', async () => {
    await setup([{ name: 'Pitch' }])
    const menu = await openMenu('Pitch')
    const rows = rowsOf(menu)
    expect(rows).toEqual(['Open', 'Present', 'Pin to top', 'Rename', 'Duplicate', 'Move to folder', 'Tags…', 'Export .odeck', 'Move to Trash'])
    expect(within(menu).getAllByRole('separator')).toHaveLength(5)
    expect(within(menu).getByRole('menuitem', { name: 'Present' })).not.toHaveAttribute('aria-disabled')
  })

  it('Present opens the slides window from the click and hands the show to the editor', async () => {
    const { ids } = await setup([{ name: 'Pitch' }])
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const menu = await openMenu('Pitch')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Present' }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe(`#/deck/${ids.Pitch}`)
    expect(takeShowRequest(ids.Pitch)).toBe('blocked')
    open.mockRestore()
  })

  it('the card has a Present button', async () => {
    const { ids } = await setup([{ name: 'Pitch' }])
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    await userEvent.click(within(card('Pitch')).getByRole('button', { name: 'Present Pitch' }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(takeShowRequest(ids.Pitch)).toBe('blocked')
    open.mockRestore()
  })

  it('says Unpin for a pinned deck', async () => {
    await setup([{ name: 'Pitch', entry: { pinnedAt: 1 } }])
    const menu = await openMenu('Pitch')
    expect(within(menu).getByRole('menuitem', { name: 'Unpin' })).toBeInTheDocument()
  })

  it('right-click opens the same menu', async () => {
    await setup([{ name: 'Pitch' }])
    fireEvent.contextMenu(within(card('Pitch')).getByRole('link', { name: 'Pitch' }))
    expect(await screen.findByRole('menu', { name: 'Actions for Pitch' })).toBeInTheDocument()
  })

  it('Open goes to the editor', async () => {
    const { ids } = await setup([{ name: 'Pitch' }])
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Open' }))
    expect(window.location.hash).toBe(`#/deck/${ids.Pitch}`)
  })

  it('Pin to top moves the deck to Pinned', async () => {
    const { store, ids } = await setup([{ name: 'Pitch' }, { name: 'Other' }])
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Pin to top' }))
    const pinned = await screen.findByRole('region', { name: 'Pinned' })
    expect(within(pinned).getByRole('link', { name: 'Pitch' })).toBeInTheDocument()
    expect((await entryOf(store, ids.Pitch)).pinnedAt).not.toBeNull()
  })

  it('pinning a fifth deck shows a toast and changes nothing', async () => {
    const { store, ids } = await setup([
      ...['A', 'B', 'C', 'D'].map((name, i) => ({ name, entry: { pinnedAt: i + 1 } })),
      { name: 'E' },
    ])
    await userEvent.click(within(await openMenu('E')).getByRole('menuitem', { name: 'Pin to top' }))
    await waitFor(() => expect(toastText()).toContain('You can pin up to 4 decks. Unpin one first.'))
    expect((await entryOf(store, ids.E)).pinnedAt).toBeNull()
  })

  it('Rename turns the name into a field; Enter saves without changing Edited', async () => {
    const { store, ids } = await setup([{ name: 'Pitch' }])
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Rename' }))
    const field = screen.getByRole('textbox', { name: 'Deck name' })
    expect(field).toHaveFocus()
    expect(field).toHaveValue('Pitch')
    await userEvent.clear(field)
    await userEvent.type(field, 'Seed round{Enter}')
    await waitFor(async () => expect(((await store.getDeck(ids.Pitch)) as Deck).name).toBe('Seed round'))
    expect(((await store.getDeck(ids.Pitch)) as Deck).updatedAt).toBe(1000)
    expect(await screen.findByRole('link', { name: 'Seed round' })).toBeInTheDocument()
  })

  it('Esc cancels a rename and an empty name keeps the old one', async () => {
    const { store, ids } = await setup([{ name: 'Pitch' }])
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Rename' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Deck name' }), 'xx{Escape}')
    expect(screen.getByRole('link', { name: 'Pitch' })).toBeInTheDocument()
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Rename' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Deck name' }))
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('link', { name: 'Pitch' })).toBeInTheDocument()
    expect(((await store.getDeck(ids.Pitch)) as Deck).name).toBe('Pitch')
  })

  it('renaming a deck open in another tab shows a toast and keeps the name', async () => {
    const { store, ids } = await setup([{ name: 'Pitch' }])
    openElsewhere.add(ids.Pitch)
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Rename' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Deck name' }), ' 2{Enter}')
    await waitFor(() => expect(toastText()).toContain('This deck is open in another tab. Rename it there.'))
    expect(await screen.findByRole('link', { name: 'Pitch' })).toBeInTheDocument()
    expect(((await store.getDeck(ids.Pitch)) as Deck).name).toBe('Pitch')
  })

  it('Duplicate adds "Copy of …" next to the original', async () => {
    await setup([{ name: 'Pitch' }, { name: 'Newer' }])
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Duplicate' }))
    const recent = await screen.findByRole('region', { name: 'Recent' })
    await waitFor(() =>
      expect(within(recent).getAllByRole('listitem').map((li) => within(li).getByRole('link').textContent)).toEqual(['Newer', 'Copy of Pitch', 'Pitch']),
    )
  })

  it('Move to folder lists No folder, the folders and New folder…, with the current one checked', async () => {
    const { store, ids } = await setup([{ name: 'Pitch' }], [{ id: 'f1', name: 'Client work' }, { id: 'f2', name: 'Talks' }])
    const menu = await openMenu('Pitch')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Move to folder' }))
    const sub = screen.getByRole('menu', { name: 'Move to folder' })
    expect(rowsOf(sub)).toEqual(['No folder', 'Client work', 'Talks', 'New folder…'])
    expect(within(sub).getByRole('menuitemradio', { name: 'No folder' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(sub).getByRole('menuitemradio', { name: 'Talks' }))
    await waitFor(async () => expect((await entryOf(store, ids.Pitch)).folderId).toBe('f2'))
    const again = await openMenu('Pitch')
    await userEvent.click(within(again).getByRole('menuitem', { name: 'Move to folder' }))
    expect(screen.getByRole('menuitemradio', { name: 'Talks' })).toHaveAttribute('aria-checked', 'true')
  })

  it('New folder… makes a folder and moves the deck into it', async () => {
    const { store, ids } = await setup([{ name: 'Pitch' }])
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Move to folder' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'New folder…' }))
    await waitFor(async () => expect((await store.listFolders()).length).toBe(1))
    const folder = (await store.listFolders())[0] as { id: string; name: string }
    expect(folder.name).toBe('New folder')
    expect((await entryOf(store, ids.Pitch)).folderId).toBe(folder.id)
  })

  it('Tags… lets you tick existing tags and create a new one with Enter', async () => {
    const { store, ids } = await setup([{ name: 'Pitch', entry: { tags: ['sales'] } }, { name: 'Other', entry: { tags: ['q4'] } }])
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Tags…' }))
    const pop = screen.getByRole('dialog', { name: 'Tags for Pitch' })
    const field = within(pop).getByRole('combobox', { name: 'Add or find a tag' })
    expect(field).toHaveFocus()
    expect(within(pop).getByRole('option', { name: 'sales' })).toHaveAttribute('aria-selected', 'true')
    expect(within(pop).getByRole('option', { name: 'q4' })).toHaveAttribute('aria-selected', 'false')
    await userEvent.click(within(pop).getByRole('option', { name: 'q4' }))
    await waitFor(async () => expect((await entryOf(store, ids.Pitch)).tags).toEqual(['sales', 'q4']))
    await userEvent.type(field, 'Investors{Enter}')
    await waitFor(async () => expect((await entryOf(store, ids.Pitch)).tags).toEqual(['sales', 'q4', 'Investors']))
    await userEvent.click(within(pop).getByRole('option', { name: 'sales' }))
    await waitFor(async () => expect((await entryOf(store, ids.Pitch)).tags).toEqual(['q4', 'Investors']))
  })

  it('typing filters the tag list', async () => {
    await setup([{ name: 'Pitch' }, { name: 'Other', entry: { tags: ['q4', 'sales'] } }])
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Tags…' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Add or find a tag' }), 'sa')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['sales'])
  })

  it('Export .odeck is available', async () => {
    await setup([{ name: 'Pitch' }])
    expect(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Export .odeck' })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('Move to Trash removes the card at once and Undo puts it back with folder, tags and pin', async () => {
    const { store, ids } = await setup(
      [{ name: 'Pitch', entry: { folderId: 'f1', tags: ['q4'], pinnedAt: 3 } }, { name: 'Other' }],
      [{ id: 'f1', name: 'Client work' }],
    )
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Move to Trash' }))
    expect(screen.queryByRole('link', { name: 'Pitch' })).toBeNull()
    await waitFor(() => expect(toastText()).toContain('“Pitch” moved to Trash'))
    await waitFor(async () => expect((await entryOf(store, ids.Pitch)).trashedAt).not.toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect(await entryOf(store, ids.Pitch)).toEqual({ ...emptyEntry(ids.Pitch), folderId: 'f1', tags: ['q4'], pinnedAt: 3 }))
    expect(await screen.findByRole('link', { name: 'Pitch' })).toBeInTheDocument()
  })

  it('the Undo toast lasts 6 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await setup([{ name: 'Pitch' }])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(within(card('Pitch')).getByRole('button', { name: 'More actions for Pitch' }))
    await user.click(screen.getByRole('menuitem', { name: 'Move to Trash' }))
    await waitFor(() => expect(toastText()).toContain('moved to Trash'))
    act(() => { vi.advanceTimersByTime(UNDO_MS - 500) })
    expect(toastText()).toContain('moved to Trash')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(toastText()).not.toContain('moved to Trash')
  })

  it('a failed change shows why and leaves things as they were', async () => {
    const store = createMemoryStore()
    const d = createDeck('Pitch')
    await store.putDeck(d)
    const full = () => new DOMException('full', 'QuotaExceededError')
    const broken: DeckStore = { ...store, async putLibrary() { throw full() }, async updateLibrary() { throw full() } }
    render(<><HomePage route={{ view: 'home' }} store={broken} /><ToastHost /></>)
    await screen.findByRole('region', { name: 'Recent' })
    await userEvent.click(within(await openMenu('Pitch')).getByRole('menuitem', { name: 'Move to Trash' }))
    await waitFor(() => expect(toastText()).toContain("Couldn't save that change. Your browser's storage for OpenDeck is full."))
    expect(await screen.findByRole('link', { name: 'Pitch' })).toBeInTheDocument()
  })
})
