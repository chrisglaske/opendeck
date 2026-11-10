import { expect, it } from 'vitest'
import { CONSENT_KEY, readConsent, writeConsent } from './consent'

const throwing = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('blocked') },
} as unknown as Storage

it('remembers the answer under the key V1 used', () => {
  expect(readConsent()).toBeNull()
  writeConsent('accepted')
  expect(readConsent()).toBe('accepted')
  expect(localStorage.getItem(CONSENT_KEY)).toBe('accepted')
  writeConsent('declined')
  expect(readConsent()).toBe('declined')
})

it('ignores values it does not know', () => {
  localStorage.setItem(CONSENT_KEY, 'yes')
  expect(readConsent()).toBeNull()
})

it('treats blocked storage as no answer and never throws', () => {
  expect(readConsent(throwing)).toBeNull()
  expect(() => writeConsent('accepted', throwing)).not.toThrow()
})
