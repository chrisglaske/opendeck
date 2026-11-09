import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireDeckLock, isAnyDeckOpen, takeOverDeckLock } from './deckLock'

/** Minimal in-page Web Locks: exclusive locks with ifAvailable and steal. */
function fakeLocks() {
  const held = new Map<string, { reject: (e: unknown) => void }>()
  return {
    async query() {
      return { held: [...held.keys()].map((name) => ({ name, mode: 'exclusive' })), pending: [] }
    },
    request(name: string, opts: { ifAvailable?: boolean; steal?: boolean }, cb: (lock: object | null) => Promise<void> | void) {
      if (held.has(name) && opts.ifAvailable) return Promise.resolve(cb(null))
      if (held.has(name) && opts.steal) {
        held.get(name)!.reject(new DOMException('stolen', 'AbortError'))
        held.delete(name)
      }
      return new Promise<void>((resolve, reject) => {
        held.set(name, { reject })
        Promise.resolve(cb({ name })).then(() => {
          held.delete(name)
          resolve()
        })
      })
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('deck lock', () => {
  it('lets only one holder at a time', async () => {
    vi.stubGlobal('navigator', { locks: fakeLocks() })
    const a = await acquireDeckLock('d1')
    expect(a.held).toBe(true)
    expect((await acquireDeckLock('d1')).held).toBe(false)
    expect((await acquireDeckLock('d2')).held).toBe(true)
    if (a.held) a.release()
    await Promise.resolve()
    await Promise.resolve()
    expect((await acquireDeckLock('d1')).held).toBe(true)
  })

  it('a takeover moves the lock and tells the old holder', async () => {
    vi.stubGlobal('navigator', { locks: fakeLocks() })
    const a = await acquireDeckLock('d1')
    if (!a.held) throw new Error('expected held')
    const lost = vi.fn()
    a.lost.then(lost)
    const b = await takeOverDeckLock('d1')
    expect(b.held).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(lost).toHaveBeenCalled()
    expect((await acquireDeckLock('d1')).held).toBe(false)
  })

  it('without Web Locks every tab holds the lock', async () => {
    vi.stubGlobal('navigator', {})
    const a = await acquireDeckLock('d1')
    expect(a.held).toBe(true)
    if (a.held) a.release()
    expect((await takeOverDeckLock('d1')).held).toBe(true)
  })
})

describe('isAnyDeckOpen', () => {
  it('is true while any deck lock is held', async () => {
    vi.stubGlobal('navigator', { locks: fakeLocks() })
    expect(await isAnyDeckOpen()).toBe(false)
    const a = await acquireDeckLock('d1')
    expect(await isAnyDeckOpen()).toBe(true)
    if (a.held) a.release()
    await Promise.resolve()
    await Promise.resolve()
    expect(await isAnyDeckOpen()).toBe(false)
  })

  it('is false without Web Locks', async () => {
    vi.stubGlobal('navigator', {})
    expect(await isAnyDeckOpen()).toBe(false)
  })
})
