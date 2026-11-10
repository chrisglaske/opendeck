import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryStore } from '../storage/deckStore'
import { storeWithin } from './storeWithin'

const said = vi.hoisted(() => ({ list: [] as string[] }))
vi.mock('../ui', () => ({ toast: (m: string) => said.list.push(m) }))

beforeEach(() => { vi.useFakeTimers(); said.list.length = 0 })
afterEach(() => vi.useRealTimers())

it('gives the store when it opens in time', async () => {
  const s = createMemoryStore()
  expect(await storeWithin(() => Promise.resolve(s))).toBe(s)
  expect(said.list).toEqual([])
})

it('gives up with a message when storage never answers, so the page is not left silent', async () => {
  const p = storeWithin(() => new Promise(() => {}), 5000)
  await vi.advanceTimersByTimeAsync(5000)
  expect(await p).toBeNull()
  expect(said.list).toEqual(["Your browser's storage isn't answering. Reload the page and try again."])
})
