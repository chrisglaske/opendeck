import { render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import App from './App'

afterEach(() => { window.location.hash = '' })

it('shows Home by default', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Make your first deck' })).toBeInTheDocument()
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
