import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { LoadErrorBoundary } from './LoadErrorBoundary'

function Broken(): never {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/HomePage-x.js')
}

it('shows a way to reload instead of a blank page when part of the app fails to load', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const reload = vi.fn()
  render(<LoadErrorBoundary reload={reload}><Broken /></LoadErrorBoundary>)
  expect(screen.getByRole('heading', { name: "Couldn't load this part of OpenDeck" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
  expect(reload).toHaveBeenCalled()
})

it('shows its children when nothing fails', () => {
  render(<LoadErrorBoundary><p>Fine</p></LoadErrorBoundary>)
  expect(screen.getByText('Fine')).toBeInTheDocument()
})

it('tries again after moving to another address', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let broken = true
  function Maybe() {
    if (broken) throw new Error('chunk')
    return <p>Back</p>
  }
  const { rerender } = render(<LoadErrorBoundary resetKey="#/a"><Maybe /></LoadErrorBoundary>)
  expect(screen.getByRole('heading', { name: "Couldn't load this part of OpenDeck" })).toBeInTheDocument()
  broken = false
  rerender(<LoadErrorBoundary resetKey="#/b"><Maybe /></LoadErrorBoundary>)
  expect(screen.getByText('Back')).toBeInTheDocument()
})
