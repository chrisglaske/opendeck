import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

type Listener = (e: MediaQueryListEvent) => void

/** Controllable stand-in for window.matchMedia (jsdom has none). */
export const mediaStub = {
  matches: false,
  listeners: new Set<Listener>(),
  /** Change the stubbed result and notify `change` listeners. */
  set(matches: boolean) {
    this.matches = matches
    for (const l of this.listeners) l({ matches } as MediaQueryListEvent)
  },
}

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      get matches() {
        return mediaStub.matches
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, l: Listener) => mediaStub.listeners.add(l),
      removeEventListener: (_: string, l: Listener) => mediaStub.listeners.delete(l),
      addListener: (l: Listener) => mediaStub.listeners.add(l),
      removeListener: (l: Listener) => mediaStub.listeners.delete(l),
      dispatchEvent: () => true,
    }) as unknown as MediaQueryList,
})

afterEach(() => {
  cleanup()
  mediaStub.matches = false
  mediaStub.listeners.clear()
  localStorage.clear()
  delete document.documentElement.dataset.mode
})
