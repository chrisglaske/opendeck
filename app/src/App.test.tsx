import { act, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'
import { markHasDecks } from './storage/visit'

const outdated = vi.hoisted(() => ({ listeners: new Set<() => void>() }))
vi.mock('./storage/idbStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./storage/idbStore')>()),
  onStorageOutdated: (cb: () => void) => {
    outdated.listeners.add(cb)
    return () => outdated.listeners.delete(cb)
  },
}))

afterEach(() => { window.location.hash = '' })

const LANDING = 'Good-looking decks, without the fuss.'

it('shows the landing page to a new visitor', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: LANDING })).toBeInTheDocument()
})

it('sends a returning visitor straight Home, never showing the landing', async () => {
  markHasDecks()
  render(<App />)
  expect(screen.queryByRole('heading', { name: LANDING })).toBeNull()
  expect(await screen.findByRole('heading', { name: 'Make your first deck' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: LANDING })).toBeNull()
})

it('shows Home at #/home', async () => {
  window.location.hash = '#/home'
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Make your first deck' })).toBeInTheDocument()
})

it('keeps deep links such as #/templates on a first visit', async () => {
  window.location.hash = '#/templates'
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'My templates' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: LANDING })).toBeNull()
})

it('routes Home views such as #/trash to Home', async () => {
  window.location.hash = '#/trash'
  render(<App />)
  expect(await screen.findByRole('navigation', { name: 'Library' })).toBeInTheDocument()
})

it('routes #/deck/<id> to the editor', async () => {
  window.location.hash = '#/deck/missing-id'
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument()
})

it('routes #/computer to the "needs a computer" note', async () => {
  window.location.hash = '#/computer'
  render(<App />)
  expect(await screen.findByRole('heading', { name: "OpenDeck's editor needs a computer." })).toBeInTheDocument()
})

it('a tab whose storage was upgraded elsewhere says so, until reloaded', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    window.location.hash = '#/home'
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
