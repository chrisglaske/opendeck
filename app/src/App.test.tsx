import { render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import App from './App'

afterEach(() => { window.location.hash = '' })

it('shows the deck list by default', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Your decks' })).toBeInTheDocument()
})

it('routes #/deck/<id> to the editor', async () => {
  window.location.hash = '#/deck/missing-id'
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument()
})
