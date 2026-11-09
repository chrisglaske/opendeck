import type { ShowAction } from './show'

export type KeyIntent = ShowAction['kind'] | 'fullscreen' | 'speaker' | 'escape' | null

const MAP: Record<string, KeyIntent> = {
  ArrowRight: 'next', ' ': 'next', PageDown: 'next', ArrowDown: 'next',
  ArrowLeft: 'back', PageUp: 'back', ArrowUp: 'back', Backspace: 'back',
  Home: 'first', End: 'last', Enter: 'enter', Escape: 'escape',
  f: 'fullscreen', F: 'fullscreen', s: 'speaker', S: 'speaker',
}

const CONTROLS = 'button, a, input, select, textarea, summary, dialog, [role=menuitem], [role=menuitemradio], [contenteditable=true]'

/** The element a key went to. Checked by shape, since it may belong to the other window. */
function closest(target: EventTarget | null | undefined, selector: string): boolean {
  const el = target as Element | null | undefined
  return typeof el?.closest === 'function' && el.closest(selector) !== null
}

/**
 * What a key does during a show, the same in every window. Keys held with a modifier are
 * left to the browser, Enter and Space to a focused control, and Esc to an open dialog.
 */
export function keyIntent(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'> & { target?: EventTarget | null }): KeyIntent {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if ((e.key === 'Enter' || e.key === ' ') && closest(e.target, CONTROLS)) return null
  if (e.key === 'Escape' && closest(e.target, 'dialog')) return null
  if (/^\d$/.test(e.key)) return 'digit'
  return MAP[e.key] ?? null
}
