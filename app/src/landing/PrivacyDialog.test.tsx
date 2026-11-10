import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readConsent, writeConsent } from '../analytics/consent'
import { PrivacyDialog } from './PrivacyDialog'

const beacons = () => document.querySelectorAll('script[data-od-beacon]')
beforeEach(() => vi.stubEnv('VITE_CF_BEACON_TOKEN', 't'))
afterEach(() => {
  vi.unstubAllEnvs()
  beacons().forEach((s) => s.remove())
})

const toggle = () => screen.getByRole('switch', { name: 'Count my visits' })

it('shows the stored answer', () => {
  writeConsent('accepted')
  render(<PrivacyDialog open onClose={() => {}} />)
  expect(screen.getByRole('dialog', { name: 'Privacy' })).toBeInTheDocument()
  expect(toggle()).toHaveAttribute('aria-checked', 'true')
})

it('is off when nothing was answered', () => {
  render(<PrivacyDialog open onClose={() => {}} />)
  expect(toggle()).toHaveAttribute('aria-checked', 'false')
})

it('switching off stores No thanks', async () => {
  writeConsent('accepted')
  render(<PrivacyDialog open onClose={() => {}} />)
  await userEvent.click(toggle())
  expect(readConsent()).toBe('declined')
  expect(toggle()).toHaveAttribute('aria-checked', 'false')
})

it('switching on stores Allow and starts the counter', async () => {
  writeConsent('declined')
  render(<PrivacyDialog open onClose={() => {}} />)
  await userEvent.click(toggle())
  expect(readConsent()).toBe('accepted')
  expect(beacons()).toHaveLength(1)
})

it('Done closes it', async () => {
  const onClose = vi.fn()
  render(<PrivacyDialog open onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(onClose).toHaveBeenCalled()
})
