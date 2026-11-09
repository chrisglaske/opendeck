import type { Deck } from '../model/types'

/** Where a running show is. `order` holds the ids of the visible slides; `typed` is a slide number being typed. */
export type ShowState = { order: string[]; index: number; typed: string; startedAt: number; pausedAt: number | null; pausedMs: number }

export type ShowAction =
  | { kind: 'next' } | { kind: 'back' } | { kind: 'first' } | { kind: 'last' }
  | { kind: 'digit'; d: string } | { kind: 'enter' } | { kind: 'clearTyped' } | { kind: 'goto'; index: number }
  | { kind: 'pause'; now: number } | { kind: 'resume'; now: number } | { kind: 'restartTimer'; now: number }

/** The slides a show goes through: every slide that isn't hidden, in order. */
export function visibleOrder(deck: Pick<Deck, 'slides'>): string[] {
  return deck.slides.filter((s) => !s.hidden).map((s) => s.id)
}

/**
 * A new show starting at `fromSlideId`, or at the first visible slide when it is null.
 * A hidden slide starts the show at the next visible one (the last visible one if none follow).
 * Null when every slide is hidden.
 */
export function startShow(deck: Pick<Deck, 'slides'>, fromSlideId: string | null, now: number): ShowState | null {
  const order = visibleOrder(deck)
  if (order.length === 0) return null
  let index = 0
  const at = fromSlideId === null ? -1 : deck.slides.findIndex((s) => s.id === fromSlideId)
  if (at >= 0) {
    const after = deck.slides.slice(at).find((s) => !s.hidden)
    index = after ? order.indexOf(after.id) : order.length - 1
  }
  return { order, index, typed: '', startedAt: now, pausedAt: null, pausedMs: 0 }
}

const clamp = (i: number, s: ShowState) => Math.min(Math.max(i, 0), s.order.length - 1)
const move = (s: ShowState, index: number): ShowState => ({ ...s, index: clamp(index, s), typed: '' })

export function showReducer(s: ShowState, a: ShowAction): ShowState {
  switch (a.kind) {
    case 'next': return move(s, s.index + 1)
    case 'back': return move(s, s.index - 1)
    case 'first': return move(s, 0)
    case 'last': return move(s, s.order.length - 1)
    case 'goto': return move(s, a.index)
    case 'digit': return /^\d$/.test(a.d) && s.typed.length < 4 ? { ...s, typed: s.typed + a.d } : s
    case 'clearTyped': return s.typed ? { ...s, typed: '' } : s
    case 'enter': return s.typed ? move(s, Number(s.typed) - 1) : move(s, s.index + 1)
    case 'pause': return s.pausedAt === null ? { ...s, pausedAt: a.now } : s
    case 'resume': return s.pausedAt === null ? s : { ...s, pausedAt: null, pausedMs: s.pausedMs + (a.now - s.pausedAt) }
    case 'restartTimer': return { ...s, startedAt: a.now, pausedMs: 0, pausedAt: s.pausedAt === null ? null : a.now }
  }
}

export const currentSlideId = (s: ShowState): string => s.order[s.index]
export const nextSlideId = (s: ShowState): string | null => s.order[s.index + 1] ?? null

/** Time spent presenting, leaving out paused time. */
export function elapsedMs(s: ShowState, now: number): number {
  return Math.max(0, (s.pausedAt ?? now) - s.startedAt - s.pausedMs)
}

/** `m:ss`, or `h:mm:ss` from one hour. */
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
