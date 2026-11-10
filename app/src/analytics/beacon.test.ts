import { afterEach, expect, it } from 'vitest'
import { BEACON_SRC, loadBeacon } from './beacon'

const scripts = () => document.querySelectorAll<HTMLScriptElement>('script[data-od-beacon]')
afterEach(() => scripts().forEach((s) => s.remove()))

it('loads nothing without a site token', () => {
  expect(loadBeacon(undefined)).toBe(false)
  expect(loadBeacon('')).toBe(false)
  expect(scripts()).toHaveLength(0)
})

it('adds the counter script once', () => {
  expect(loadBeacon('t')).toBe(true)
  expect(scripts()).toHaveLength(1)
  const s = scripts()[0]
  expect(s.src).toBe(BEACON_SRC)
  expect(s.defer).toBe(true)
  expect(s.getAttribute('data-cf-beacon')).toBe('{"token":"t"}')
  expect(loadBeacon('t')).toBe(true)
  expect(scripts()).toHaveLength(1)
})
