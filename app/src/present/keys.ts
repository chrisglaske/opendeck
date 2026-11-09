import type { ShowAction } from './show'

export type KeyIntent = ShowAction['kind'] | 'fullscreen' | 'speaker' | 'escape' | null

const MAP: Record<string, KeyIntent> = {
  ArrowRight: 'next', ' ': 'next', PageDown: 'next', ArrowDown: 'next',
  ArrowLeft: 'back', PageUp: 'back', ArrowUp: 'back', Backspace: 'back',
  Home: 'first', End: 'last', Enter: 'enter', Escape: 'escape',
  f: 'fullscreen', F: 'fullscreen', s: 'speaker', S: 'speaker',
}

/** What a key does during a show, the same in every window. Keys held with a modifier are left to the browser. */
export function keyIntent(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): KeyIntent {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (/^\d$/.test(e.key)) return 'digit'
  return MAP[e.key] ?? null
}
