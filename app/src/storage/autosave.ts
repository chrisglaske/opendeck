import type { Deck } from '../model/types'
import type { DeckStore } from './deckStore'

export type SaveErrorReason = 'quota' | 'unavailable' | 'deleted' | 'unknown'
export type SaveStatus = { state: 'saved' } | { state: 'saving' } | { state: 'error'; reason: SaveErrorReason }

export interface Autosaver {
  schedule(d: Deck): void
  flush(): Promise<void>
  /**
   * Starts writing the waiting deck right now, in this same tick. For the last moment before the
   * browser closes the storage connection, when nothing can be awaited first.
   */
  flushNow(): void
  getStatus(): SaveStatus
  subscribe(fn: () => void): () => void
  dispose(): void
}

const RETRY_MS = 5000

export function errorReason(e: unknown): SaveErrorReason {
  const name = (e as { name?: unknown } | null)?.name
  if (name === 'QuotaExceededError') return 'quota'
  if (name === 'InvalidStateError' || name === 'SecurityError' || name === 'UnknownError' || name === 'NotFoundError') return 'unavailable'
  return 'unknown'
}

/**
 * Saves the latest deck a short while after a change. Only the newest deck is
 * kept; writes never overlap. On failure the deck stays in memory, the status
 * says why, and the next change (or a timed retry) tries again. With `existing`, a deck that
 * has been deleted in another tab is never written back: the status says so instead.
 */
export function createAutosaver(store: DeckStore, opts: { delay?: number; existing?: boolean } = {}): Autosaver {
  const delay = opts.delay ?? 600
  let pending: Deck | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null
  let status: SaveStatus = { state: 'saved' }
  let disposed = false
  const listeners = new Set<() => void>()

  function setStatus(s: SaveStatus) {
    if (s.state === status.state && (s.state !== 'error' || (status.state === 'error' && s.reason === status.reason))) return
    status = s
    listeners.forEach((fn) => fn())
  }

  function clearTimers() {
    if (timer) clearTimeout(timer)
    if (retry) clearTimeout(retry)
    timer = retry = null
  }

  async function run(): Promise<void> {
    timer = null
    if (inFlight) await inFlight
    if (disposed || !pending) {
      // Another caller took the pending deck and is writing it; resolve when that write ends.
      if (inFlight) await inFlight
      return
    }
    const deck = pending
    pending = null
    inFlight = (async () => {
      try {
        if (opts.existing && (await store.getDeck(deck.id)) == null) {
          setStatus({ state: 'error', reason: 'deleted' })
          return
        }
        await store.putDeck(deck)
        if (!pending) setStatus({ state: 'saved' })
      } catch (e) {
        if (!pending) pending = deck // keep it for the retry
        setStatus({ state: 'error', reason: errorReason(e) })
        if (!disposed && !retry) retry = setTimeout(() => { retry = null; void run() }, RETRY_MS)
      }
    })()
    await inFlight
    inFlight = null
    if (pending && !timer && !retry && !disposed) timer = setTimeout(run, delay)
  }

  return {
    schedule(d) {
      if (disposed) return
      pending = d
      if (status.state !== 'error') setStatus({ state: 'saving' })
      if (retry) { clearTimeout(retry); retry = null }
      if (!timer) timer = setTimeout(run, delay)
    },
    async flush() {
      clearTimers()
      await run()
    },
    flushNow() {
      if (disposed || !pending || inFlight) return
      clearTimers()
      const deck = pending
      pending = null
      const write = store.putDeck(deck).then(
        () => { if (!pending) setStatus({ state: 'saved' }) },
        (e) => {
          if (!pending) pending = deck
          setStatus({ state: 'error', reason: errorReason(e) })
        },
      )
      inFlight = write.finally(() => { if (inFlight === write) inFlight = null })
    },
    getStatus: () => status,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    dispose() {
      disposed = true
      clearTimers()
      listeners.clear()
    },
  }
}
