import { render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStore } from '../storage/deckStore'
import type { DeckStore } from '../storage/deckStore'
import { ToastHost } from '../ui'
import { OLD_VERSION_URL, V1_META } from '../v1/importV1'
import { v1Fixture } from '../v1/testFixtures'
import HomePage from './HomePage'

class FakeCanvas {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  getContext() { return { drawImage() {} } }
  async convertToBlob(o: { type: string }) { return new Blob([new Uint8Array(10)], { type: o.type }) }
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('createImageBitmap', async () => ({ width: 300, height: 100, close() {} }))
  vi.stubGlobal('OffscreenCanvas', FakeCanvas)
})
afterEach(() => {
  localStorage.clear()
  window.location.hash = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const projectsOf = (name: Parameters<typeof v1Fixture>[0]) => JSON.parse(v1Fixture(name).openDeckDB_v2) as Record<string, unknown>[]
function seedV1(projects: unknown[], folders?: string) {
  localStorage.setItem('openDeckDB_v2', JSON.stringify(projects))
  if (folders) localStorage.setItem('openDeckFolders_v1', folders)
}

async function home(store: DeckStore = createMemoryStore()) {
  const view = render(<><HomePage route={{ view: 'home' }} store={store} /><ToastHost /></>)
  await screen.findByRole('heading', { level: 1, name: 'Home' })
  return { store, view }
}
const toastText = () => screen.queryAllByRole('status').map((s) => s.textContent).join(' | ')

describe('the one-time V1 notice', () => {
  it('tells how many decks came over, with previews, and is shown once', async () => {
    seedV1(projectsOf('organized'), v1Fixture('organized').openDeckFolders_v1)
    const { store, view } = await home()
    const dialog = await screen.findByRole('dialog', { name: 'Your 4 decks are here, in the new design' })
    expect(within(dialog).getByText(/We copied your decks, folders and tags from the old OpenDeck\. Same content, new look, so slides may sit a little differently\. Anything we couldn't place is kept in that slide's speaker notes\./)).toBeInTheDocument()
    expect(within(dialog).getByText('The originals are untouched. You can still open them in the old version.')).toBeInTheDocument()
    expect(dialog.querySelectorAll('[data-v1-preview]')).toHaveLength(3)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await store.getMeta(V1_META.noticePending)).toBe(0)
    view.unmount()
    await home(store)
    await screen.findByRole('region', { name: 'Recent' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('waits for the copy before Home shows, even when effects run twice (StrictMode)', async () => {
    seedV1(projectsOf('branded'))
    const store = createMemoryStore()
    const put = store.putDeck.bind(store)
    store.putDeck = async (d) => { await new Promise((r) => setTimeout(r, 100)); return put(d) }
    render(<StrictMode><HomePage route={{ view: 'home' }} store={store} /></StrictMode>)
    // A focus refresh while the copy is still running must not show Home early either.
    window.dispatchEvent(new Event('focus'))
    expect(await screen.findByRole('dialog', { name: 'Your 1 deck is here, in the new design' })).toBeInTheDocument()
  })

  it('says "deck" for one', async () => {
    seedV1(projectsOf('branded'))
    await home()
    expect(await screen.findByRole('dialog', { name: 'Your 1 deck is here, in the new design' })).toBeInTheDocument()
  })

  it('opens the old version in a new tab', async () => {
    seedV1(projectsOf('branded'))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { store } = await home()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Open the old version' }))
    expect(open).toHaveBeenCalledWith(OLD_VERSION_URL, '_blank', 'noopener')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await store.getMeta(V1_META.noticePending)).toBe(0)
  })

  it('is not shown without V1 data', async () => {
    await home()
    await screen.findByRole('heading', { name: 'Make your first deck' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('converted decks on Home', () => {
  it('show a From V1 chip', async () => {
    seedV1(projectsOf('branded'))
    await home()
    await userEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    const card = (await screen.findAllByRole('listitem')).find((li) => within(li).queryByRole('link', { name: 'Branded deck' }))!
    expect(within(card).getByText('From V1')).toBeInTheDocument()
  })
})

describe('Import → From V1', () => {
  const openImport = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    return screen.getByRole('menu', { name: 'Import' })
  }

  it('is hidden without V1 data', async () => {
    await home()
    expect(within(await openImport()).queryByRole('menuitem', { name: /From V1/ })).toBeNull()
  })

  it('is greyed out with "Nothing new in V1" when everything was copied', async () => {
    seedV1(projectsOf('branded'))
    await home()
    await userEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    const item = within(await openImport()).getByRole('menuitem', { name: /From V1/ })
    await waitFor(() => expect(item).toHaveTextContent('Nothing new in V1'))
    expect(item).toHaveAttribute('aria-disabled', 'true')
  })

  it('copies decks added in V1 since, then offers to show them', async () => {
    seedV1(projectsOf('branded'))
    const { store } = await home()
    await userEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    seedV1([...projectsOf('branded'), { ...projectsOf('branded')[0], id: 'proj_new', name: 'Made later' }])
    const item = within(await openImport()).getByRole('menuitem', { name: /From V1/ })
    await waitFor(() => expect(item).toHaveTextContent('1 new'))
    await userEvent.click(item)
    await waitFor(() => expect(toastText()).toContain('1 deck copied from V1'))
    expect((await store.listDecks()).map((d) => d.name).sort()).toEqual(['Branded deck', 'Made later'])
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(window.location.hash).toBe('#/all')
  })

  it('imports a V1 .odeck file through Deck file', async () => {
    const { store } = await home()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Deck file (.odeck)…' }))
    await userEvent.upload(screen.getByLabelText('Deck file'), new File([JSON.stringify(projectsOf('branded')[0])], 'branded.odeck'))
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/deck\//))
    expect((await store.listDecks()).map((d) => d.name)).toEqual(['Branded deck'])
  })
})
