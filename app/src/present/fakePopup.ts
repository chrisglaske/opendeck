import { vi } from 'vitest'

/** A stand-in for a pop-up window in jsdom: its own document, its own events, and `closed`. */
export type FakePopup = Window & { closed: boolean; fontsAdded: { family: string }[] }

export function fakePopup(): FakePopup {
  const doc = document.implementation.createHTMLDocument('')
  const events = new EventTarget()
  const fontsAdded: { family: string }[] = []
  const win = Object.assign(events, {
    document: doc,
    closed: false,
    fontsAdded,
    close() { win.closed = true },
    focus: vi.fn(),
    matchMedia: window.matchMedia,
    FontFace: class { family: string; constructor(family: string) { this.family = family } },
  }) as unknown as FakePopup
  Object.defineProperty(doc, 'defaultView', { value: win })
  Object.defineProperty(doc, 'fonts', { value: { add: (f: { family: string }) => fontsAdded.push(f) } })
  return win
}

/** What reloading the pop-up does in real browsers: same window, a fresh empty page. */
export function reloadPopup(win: FakePopup): void {
  const doc = document.implementation.createHTMLDocument('')
  Object.defineProperty(doc, 'defaultView', { value: win })
  Object.defineProperty(doc, 'fonts', { value: { add: (f: { family: string }) => win.fontsAdded.push(f) } })
  ;(win as { document: Document }).document = doc
}
