import { openSlidesWindow } from './popup'
import { getPresentMode, setPresentMode } from './prefs'
import type { PresentMode } from './prefs'
import type { ShowStart } from './PresentSession'

/**
 * Starts presenting from a click: opens the slides window, or asks for full screen, while the
 * click still counts as the person's action (browsers allow pop-ups and full screen only then).
 * The mode given, or else the remembered one, is remembered for next time. 'blocked' when the
 * browser blocked the slides window.
 */
export function beginShow(opts: { mode?: PresentMode; fromStart: boolean; fromSlideId: string | null }): ShowStart | 'blocked' {
  const mode = opts.mode ?? getPresentMode()
  setPresentMode(mode)
  const fromSlideId = opts.fromStart ? null : opts.fromSlideId
  if (mode === 'fullscreen') {
    void document.documentElement.requestFullscreen?.()?.catch(() => {})
    return { mode, fromSlideId, popup: null }
  }
  const popup = openSlidesWindow()
  return popup ? { mode, fromSlideId, popup } : 'blocked'
}

/**
 * A show Home started for a deck, waiting for the editor to open it. Kept in memory: the
 * slides window handle can't be stored, and opening the deck from Home doesn't reload the page.
 */
let pending: { deckId: string; start: ShowStart | 'blocked' } | null = null

export function requestShow(deckId: string, start: ShowStart | 'blocked'): void {
  pending = { deckId, start }
}

/** The show waiting for this deck, once; null after that and for any other deck. */
export function takeShowRequest(deckId: string): ShowStart | 'blocked' | null {
  if (pending?.deckId !== deckId) return null
  const { start } = pending
  pending = null
  return start
}

/** Undoes what a show start did when the show can't happen (the deck didn't open, every slide is hidden). */
export function cancelShowStart(start: ShowStart | 'blocked'): void {
  if (start === 'blocked') return
  start.popup?.close()
  if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => {})
}
