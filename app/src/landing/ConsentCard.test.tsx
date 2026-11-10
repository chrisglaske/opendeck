import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readConsent, writeConsent } from '../analytics/consent'
import { ConsentCard } from './ConsentCard'

const beacons = () => document.querySelectorAll('script[data-od-beacon]')
beforeEach(() => vi.stubEnv('VITE_CF_BEACON_TOKEN', 't'))
afterEach(() => {
  vi.unstubAllEnvs()
  beacons().forEach((s) => s.remove())
})

const region = () => screen.queryByRole('region', { name: 'Visitor counts' })

it('asks on a first visit', () => {
  render(<ConsentCard />)
  expect(region()).toBeInTheDocument()
  expect(screen.getByText('Count this visit?')).toBeInTheDocument()
})

it('Allow remembers the answer and starts the counter once', async () => {
  render(<ConsentCard />)
  await userEvent.click(screen.getByRole('button', { name: 'Allow' }))
  expect(readConsent()).toBe('accepted')
  expect(beacons()).toHaveLength(1)
  expect(region()).toBeNull()
})

it('No thanks remembers the answer and loads nothing', async () => {
  render(<ConsentCard />)
  await userEvent.click(screen.getByRole('button', { name: 'No thanks' }))
  expect(readConsent()).toBe('declined')
  expect(beacons()).toHaveLength(0)
  expect(region()).toBeNull()
})

it('stays away once answered', () => {
  writeConsent('declined')
  render(<ConsentCard />)
  expect(region()).toBeNull()
})
