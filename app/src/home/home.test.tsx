import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createDeck } from '../model/factory'
import { createMemoryStore } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { takeSlidesPanelRequest } from '../editor/slides/openRequest'
import HomePage from './HomePage'
import { emptyEntry, trash } from './library'

afterEach(() => { window.location.hash = '' })

type Seed = { name: string; updatedAt?: number; pinnedAt?: number; tags?: string[]; trashed?: boolean; slides?: number }

async function storeWith(seeds: Seed[]): Promise<{ store: DeckStore; ids: Record<string, string> }> {
  const store = createMemoryStore()
  const ids: Record<string, string> = {}
  for (const [i, s] of seeds.entries()) {
    const d = { ...createDeck(s.name), updatedAt: s.updatedAt ?? i + 1 }
    for (let n = 1; n < (s.slides ?? 1); n++) d.slides.push({ ...d.slides[0], id: d.id + n })
    await store.putDeck(d)
    ids[s.name] = d.id
    let e = { ...emptyEntry(d.id), pinnedAt: s.pinnedAt ?? null, tags: s.tags ?? [] }
    if (s.trashed) e = trash(e, Date.now())
    await store.putLibrary(e)
  }
  return { store, ids }
}

const section = (name: string) => screen.getByRole('region', { name })
const cardNames = (region: HTMLElement) =>
  within(region).queryAllByRole('listitem').map((li) => li.querySelector('[data-deck-name]')?.textContent)

describe('Home', () => {
  it('the logo goes to the start page', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const logo = within(await screen.findByRole('complementary')).getByRole('link', { name: 'OpenDeck start page' })
    expect(logo).toHaveAttribute('href', '/')
  })

  it('has a Privacy link, so people with decks can change the visitor-count answer', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    await userEvent.click(within(await screen.findByRole('complementary')).getByRole('button', { name: 'Privacy' }))
    const dialog = screen.getByRole('dialog', { name: 'Privacy' })
    expect(within(dialog).getByRole('switch', { name: 'Count my visits' })).toBeInTheDocument()
  })

  it('shows Start something new with Blank, the starters and Browse all', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const start = await screen.findByRole('region', { name: 'Start something new' })
    const names = ['Blank', 'Pitch deck', 'Tech talk', 'Quarterly review', 'Workshop', 'Browse all']
    const buttons = within(start).getAllByRole('button')
    expect(buttons).toHaveLength(6)
    names.forEach((name, i) => expect(within(start).getByRole('button', { name })).toBe(buttons[i]))
  })

  it('Blank saves a new deck and opens it; a starter makes that deck', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const start = await screen.findByRole('region', { name: 'Start something new' })
    await userEvent.click(within(start).getByRole('button', { name: 'Pitch deck' }))
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\/.+/))
    const deck = (await store.getDeck(window.location.hash.slice('#/deck/'.length))) as { name: string; slides: unknown[] }
    expect(deck.name).toBe('Pitch deck')
    expect(deck.slides).toHaveLength(10)
    window.location.hash = ''
    await userEvent.click(within(start).getByRole('button', { name: 'Blank' }))
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\/.+/))
    expect(await store.getDeck(window.location.hash.slice('#/deck/'.length))).not.toBeNull()
  })

  it('a quick double-click on Blank makes one deck, even while saving is slow', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const put = store.putDeck.bind(store)
    let puts = 0
    store.putDeck = async (d) => {
      puts++
      await gate
      return put(d)
    }
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const start = await screen.findByRole('region', { name: 'Start something new' })
    await userEvent.dblClick(within(start).getByRole('button', { name: 'Blank' }))
    release()
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\/.+/))
    expect(puts).toBe(1)
  })

  it('Browse all makes a blank deck, opens it and asks the editor to show the Slides panel', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const start = await screen.findByRole('region', { name: 'Start something new' })
    await userEvent.click(within(start).getByRole('button', { name: 'Browse all' }))
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\/.+/))
    const id = window.location.hash.slice('#/deck/'.length)
    expect(await store.getDeck(id)).not.toBeNull()
    expect(takeSlidesPanelRequest(id)).toBe(true)
    expect(takeSlidesPanelRequest(id)).toBe(false)
  })

  it('New deck in the top bar opens a new blank deck', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    await userEvent.click(await screen.findByRole('button', { name: 'New deck' }))
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\/.+/))
  })

  it('hides Pinned with no pins', async () => {
    const { store } = await storeWith([{ name: 'A' }, { name: 'B' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    await screen.findByRole('region', { name: 'Recent' })
    expect(screen.queryByRole('region', { name: 'Pinned' })).toBeNull()
  })

  it('shows pinned decks and does not repeat them in Recent', async () => {
    const { store } = await storeWith([{ name: 'A' }, { name: 'B', pinnedAt: 5 }, { name: 'C' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    expect(cardNames(await screen.findByRole('region', { name: 'Pinned' }))).toEqual(['B'])
    expect(cardNames(section('Recent'))).toEqual(['C', 'A'])
  })

  it('caps Recent at 8, newest first, with an All decks link', async () => {
    const { store } = await storeWith(Array.from({ length: 10 }, (_, i) => ({ name: 'D' + i })))
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const recent = await screen.findByRole('region', { name: 'Recent' })
    expect(within(recent).getAllByRole('listitem')).toHaveLength(8)
    expect(within(recent).getAllByRole('listitem').map((li) => li.querySelector('[data-deck-name]')?.textContent)).toEqual(
      ['D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2'],
    )
    expect(within(recent).getByRole('link', { name: 'All decks' })).toHaveAttribute('href', '#/all')
  })

  it('a card shows name, Edited …, slide count, tag chips and a pin mark', async () => {
    const { store } = await storeWith([{ name: 'Pitch', pinnedAt: 1, tags: ['q4', 'draft'], slides: 3, updatedAt: Date.now() - 2 * 3600_000 }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const card = within(await screen.findByRole('region', { name: 'Pinned' })).getByRole('listitem')
    expect(within(card).getByText('Edited 2 h ago · 3 slides')).toBeInTheDocument()
    expect(within(card).getByText('q4')).toBeInTheDocument()
    expect(within(card).getByText('draft')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'Pinned' })).toBeInTheDocument()
  })

  it('clicking a card opens the deck', async () => {
    const { store, ids } = await storeWith([{ name: 'Pitch' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const link = within(await screen.findByRole('region', { name: 'Recent' })).getByRole('link', { name: 'Pitch' })
    expect(link).toHaveAttribute('href', `#/deck/${ids.Pitch}`)
  })

  it('the sidebar lists Home, All decks, My templates, Brand kit and Trash with counts', async () => {
    const { store } = await storeWith([{ name: 'A' }, { name: 'B' }, { name: 'Gone', trashed: true }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const nav = await screen.findByRole('navigation', { name: 'Library' })
    await waitFor(() => expect(within(nav).getByRole('link', { name: /All decks/ })).toHaveTextContent('All decks2'))
    expect(within(nav).getAllByRole('link').slice(0, 5).map((a) => a.textContent)).toEqual(
      ['Home', 'All decks2', 'My templates0', 'Brand kit', 'Trash1'],
    )
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('Trash shows no count when it is empty', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    const nav = await screen.findByRole('navigation', { name: 'Library' })
    await waitFor(() => expect(within(nav).getByRole('link', { name: /All decks/ })).toHaveTextContent('All decks1'))
    expect(within(nav).getByRole('link', { name: 'Trash' }).textContent).toBe('Trash')
  })

  it('trashed decks never appear on Home', async () => {
    const { store } = await storeWith([{ name: 'Live' }, { name: 'Gone', trashed: true, pinnedAt: 1 }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    expect(cardNames(await screen.findByRole('region', { name: 'Recent' }))).toEqual(['Live'])
    expect(screen.queryByText('Gone')).toBeNull()
  })

  it('the sidebar footer has the appearance switch and the on-device note', async () => {
    const { store } = await storeWith([{ name: 'A' }])
    render(<HomePage route={{ view: 'home' }} store={store} />)
    expect(await screen.findByText('Everything stays on this device')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Appearance' })).toBeInTheDocument()
  })

  it('first visit shows Make your first deck and hides Folders, Tags and counts', async () => {
    render(<HomePage route={{ view: 'home' }} store={createMemoryStore()} />)
    expect(await screen.findByRole('heading', { name: 'Make your first deck' })).toBeInTheDocument()
    expect(screen.getByText('Pick a starter and type over it, or start blank. Everything stays on this device.')).toBeInTheDocument()
    const start = screen.getByRole('region', { name: 'Make your first deck' })
    expect(within(start).getAllByRole('button')).toHaveLength(6)
    expect(screen.queryByRole('region', { name: 'Recent' })).toBeNull()
    const nav = screen.getByRole('navigation', { name: 'Library' })
    expect(within(nav).queryByText('Folders')).toBeNull()
    expect(within(nav).queryByText('Tags')).toBeNull()
    expect(within(nav).getByRole('link', { name: 'All decks' }).textContent).toBe('All decks')
  })

  it('cleans up decks that have been in the Trash for 30 days when Home opens', async () => {
    const store = createMemoryStore()
    const old = createDeck('Old')
    await store.putDeck(old)
    await store.putLibrary(trash(emptyEntry(old.id), Date.now() - 31 * 24 * 3600_000))
    render(<HomePage route={{ view: 'home' }} store={store} />)
    await screen.findByRole('heading', { name: 'Make your first deck' })
    await waitFor(async () => expect(await store.getDeck(old.id)).toBeNull())
  })
})
