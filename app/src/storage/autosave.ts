import type { Deck } from '../model/types'
import type { DeckStore } from './deckStore'

export type SaveStatus = { state: 'saved' } | { state: 'saving' } | { state: 'error'; reason: 'quota' | 'unavailable' | 'unknown' }

export interface Autosaver {
  schedule(d: Deck): void
  flush(): Promise<void>
  getStatus(): SaveStatus
  subscribe(fn: () => void): () => void
  dispose(): void
}

const RETRY_MS = 5000

export function errorReason(e: unknown): 'quota' | 'unavailable' | 'unknown' {
  const name = (e as { name?: unknown } | null)?.name
  if (name === 'QuotaExceededError') return 'quota'
  if (name === 'InvalidStateError' || name === 'SecurityError' || name === 'UnknownError' || name === 'NotFoundError') return 'unavailable'
  return 'unknown'
}

/**
 * Saves the latest deck a short while after a change. Only the newest deck is
 * kept; writes never overlap. On failure the deck stays in memory, the status
 * says why, and the next change (or a timed retry) tries again.
 */
export function createAutosaver(store: DeckStore, opts: { delay?: number } = {}): Autosaver {
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
    if (disposed || !pending) return
    const deck = pending
    pending = null
    inFlight = (async () => {
      try {
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
