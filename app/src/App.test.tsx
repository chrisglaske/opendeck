import { render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import App from './App'
import { markHasDecks } from './storage/visit'

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
