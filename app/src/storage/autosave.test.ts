import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaver } from './autosave'
import { createMemoryStore } from './deckStore'
import type { DeckStore } from './deckStore'
import { createDeck } from '../model/factory'
import type { Deck } from '../model/types'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function spyStore(fail?: () => Error): DeckStore & { puts: Deck[] } {
  const base = createMemoryStore()
  const puts: Deck[] = []
  return {
    ...base,
    puts,
    async putDeck(d) {
      puts.push(d)
      if (fail) throw fail()
      await base.putDeck(d)
    },
  }
}
const quota = () => new DOMException('full', 'QuotaExceededError')

describe('autosaver', () => {
  it('writes once with the latest deck after the delay', async () => {
    const store = spyStore()
    const a = createAutosaver(store)
    const d = createDeck('x')
    a.schedule({ ...d, name: '1' })
    vi.advanceTimersByTime(200)
    a.schedule({ ...d, name: '2' })
    vi.advanceTimersByTime(200)
    a.schedule({ ...d, name: '3' })
    expect(a.getStatus()).toEqual({ state: 'saving' })
    await vi.advanceTimersByTimeAsync(600)
    expect(store.puts.map((p) => p.name)).toEqual(['3'])
    expect(a.getStatus()).toEqual({ state: 'saved' })
  })

  it('notifies subscribers of status changes', async () => {
    const a = createAutosaver(spyStore())
    const seen: string[] = []
    a.subscribe(() => seen.push(a.getStatus().state))
    a.schedule(createDeck())
    await vi.advanceTimersByTimeAsync(600)
    expect(seen).toEqual(['saving', 'saved'])
  })

  it('reports quota errors without throwing, then retries on the next schedule', async () => {
    let failing = true
    const store = spyStore()
    const failingStore: DeckStore = { ...store, putDeck: (d) => (failing ? Promise.reject(quota()) : store.putDeck(d)) }
    const a = createAutosaver(failingStore)
    const d = createDeck()
    a.schedule(d)
    await vi.advanceTimersByTimeAsync(600)
    expect(a.getStatus()).toEqual({ state: 'error', reason: 'quota' })
    failing = false
    a.schedule({ ...d, name: 'next' })
    await vi.advanceTimersByTimeAsync(600)
    expect(a.getStatus()).toEqual({ state: 'saved' })
    expect(store.puts.at(-1)!.name).toBe('next')
  })

  it('maps other storage errors to unavailable or unknown', async () => {
    const a = createAutosaver(spyStore(() => new DOMException('no', 'InvalidStateError')))
    a.schedule(createDeck())
    await vi.advanceTimersByTimeAsync(600)
    expect(a.getStatus()).toEqual({ state: 'error', reason: 'unavailable' })
    const b = createAutosaver(spyStore(() => new Error('boom')))
    b.schedule(createDeck())
    await vi.advanceTimersByTimeAsync(600)
    expect(b.getStatus()).toEqual({ state: 'error', reason: 'unknown' })
  })

  it('flush writes immediately and resolves after the write', async () => {
    const store = spyStore()
    const a = createAutosaver(store)
    a.schedule(createDeck('now'))
    await a.flush()
    expect(store.puts.map((p) => p.name)).toEqual(['now'])
    expect(a.getStatus()).toEqual({ state: 'saved' })
  })

  it('dispose stops pending writes', async () => {
    const store = spyStore()
    const a = createAutosaver(store)
    a.schedule(createDeck())
    a.dispose()
    await vi.advanceTimersByTimeAsync(2000)
    expect(store.puts).toEqual([])
  })
})
