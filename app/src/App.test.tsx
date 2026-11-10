import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const outdated = vi.hoisted(() => ({ listeners: new Set<() => void>() }))
vi.mock('./storage/idbStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./storage/idbStore')>()),
  onStorageOutdated: (cb: () => void) => {
    outdated.listeners.add(cb)
    return () => outdated.listeners.delete(cb)
  },
}))

const goToApp = vi.hoisted(() => vi.fn<(hash: string) => void>())
vi.mock('./app/surface', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./app/surface')>()),
  goToApp,
}))

/** Puts the page at `path` with `hash`, as if the browser had opened that address. */
function at(path: string, hash = '') {
  window.history.replaceState(null, '', path + hash)
}

afterEach(() => {
  at('/')
  goToApp.mockReset()
})

const LANDING = 'Good-looking decks, without the fuss.'

describe('the site address (/)', () => {
  it('shows the landing page to a new visitor', async () => {
    at('/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: LANDING })).toBeInTheDocument()
  })

  it('shows the landing page to a returning visitor too', async () => {
    localStorage.setItem('openDeckDB_v2', '[]')
    at('/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: LANDING })).toBeInTheDocument()
  })

  it('shows the "needs a computer" note at #/computer', async () => {
    at('/', '#/computer')
    render(<App />)
    expect(await screen.findByRole('heading', { name: "OpenDeck's editor needs a computer." })).toBeInTheDocument()
  })

  it('sends app addresses such as #/deck/<id> and #/home to /app/, keeping the hash', async () => {
    at('/', '#/deck/abc')
    render(<App />)
    await waitFor(() => expect(goToApp).toHaveBeenCalledWith('#/deck/abc'))
    expect(screen.queryByRole('heading', { name: LANDING })).toBeNull()
  })
})

describe('the app address (/app/)', () => {
  it('shows Home, never the landing page', async () => {
    at('/app/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Make your first deck' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: LANDING })).toBeNull()
    expect(document.title).toBe('OpenDeck')
  })

  it('shows Home at #/home', async () => {
    at('/app/', '#/home')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Make your first deck' })).toBeInTheDocument()
  })

  it('keeps deep links such as #/templates', async () => {
    at('/app/', '#/templates')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'My templates' })).toBeInTheDocument()
  })

  it('routes Home views such as #/trash to Home', async () => {
    at('/app/', '#/trash')
    render(<App />)
    expect(await screen.findByRole('navigation', { name: 'Library' })).toBeInTheDocument()
  })

  it('routes #/deck/<id> to the editor', async () => {
    at('/app/', '#/deck/missing-id')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument()
  })
})

it('a tab whose storage was upgraded elsewhere says so, until reloaded', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    at('/app/', '#/home')
    render(<App />)
    expect(outdated.listeners.size).toBe(1)
    act(() => outdated.listeners.forEach((cb) => cb()))
    const region = screen.getByRole('status')
    expect(within(region).getByText('OpenDeck was updated in another tab. Reload to keep saving.')).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(60_000))
    expect(within(region).getByText('OpenDeck was updated in another tab. Reload to keep saving.')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

it('an app address at the root turns into the app without reloading, and Back returns to the start page', async () => {
  const real = (await vi.importActual<typeof import('./app/surface')>('./app/surface')).goToApp
  goToApp.mockImplementation(real)
  at('/')
  render(<App />)
  expect(await screen.findByRole('heading', { name: LANDING })).toBeInTheDocument()
  act(() => {
    window.history.pushState(null, '', '/#/home')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  expect(await screen.findByRole('heading', { name: 'Make your first deck' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/app/')
  expect(document.title).toBe('OpenDeck')
  act(() => {
    window.history.replaceState(null, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(await screen.findByRole('heading', { name: LANDING })).toBeInTheDocument()
  expect(document.title).not.toBe('OpenDeck')
})

it('opening an app address at the root shows the app straight away', async () => {
  const real = (await vi.importActual<typeof import('./app/surface')>('./app/surface')).goToApp
  goToApp.mockImplementation(real)
  at('/', '#/home')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Make your first deck' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/app/')
})
