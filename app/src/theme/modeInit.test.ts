import { afterEach, expect, it } from 'vitest'
import source from '../../public/mode-init.js?raw'
import { mediaStub } from '../test/setup'

const run = () => new Function(source)()
const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')!

afterEach(() => {
  Object.defineProperty(window, 'localStorage', realStorage)
})

it('applies a stored dark mode', () => {
  localStorage.setItem('opendeck.v2.colorMode', 'dark')
  mediaStub.matches = false
  run()
  expect(document.documentElement.dataset.mode).toBe('dark')
})

it('follows the system when nothing is stored', () => {
  mediaStub.matches = true
  run()
  expect(document.documentElement.dataset.mode).toBe('dark')
})

it('falls back to the system when localStorage throws', () => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked')
    },
  })
  mediaStub.matches = false
  expect(run).not.toThrow()
  expect(document.documentElement.dataset.mode).toBe('light')
})
