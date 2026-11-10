import { afterEach, expect, it, vi } from 'vitest'
import { goToApp, onAddressMoved } from './surface'

afterEach(() => window.history.replaceState(null, '', '/'))

it('moves to /app/ in place, keeping the hash, and says so', () => {
  window.history.replaceState(null, '', '/#/deck/abc')
  const length = window.history.length
  const moved = vi.fn()
  const off = onAddressMoved(moved)
  goToApp('#/deck/abc')
  off()
  expect(window.location.pathname).toBe('/app/')
  expect(window.location.hash).toBe('#/deck/abc')
  expect(window.history.length).toBe(length)
  expect(moved).toHaveBeenCalledTimes(1)
})
