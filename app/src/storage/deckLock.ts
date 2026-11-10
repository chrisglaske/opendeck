/**
 * One editing tab per deck, using the Web Locks API. The lock is held until
 * `release()`; if another tab takes it over, `lost` resolves.
 */
export type HeldLock = { held: true; release(): void; lost: Promise<void> }
export type DeckLockResult = HeldLock | { held: false }

const lockName = (id: string) => 'opendeck-deck:' + id
const never = new Promise<void>(() => {})
const noLock = (): HeldLock => ({ held: true, release() {}, lost: never })

function request(id: string, options: LockOptions): Promise<DeckLockResult> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) return Promise.resolve(noLock())
  return new Promise((resolve) => {
    let markLost!: () => void
    const lost = new Promise<void>((r) => (markLost = r))
    locks
      .request(lockName(id), options, (lock) => {
        if (!lock) {
          resolve({ held: false })
          return
        }
        return new Promise<void>((release) => resolve({ held: true, release: () => release(), lost }))
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') markLost()
      })
  })
}

export function acquireDeckLock(id: string): Promise<DeckLockResult> {
  return request(id, { ifAvailable: true })
}

export function takeOverDeckLock(id: string): Promise<HeldLock> {
  return request(id, { steal: true }) as Promise<HeldLock>
}

/** True while any tab has a deck open in the editor. False when the browser has no Web Locks. */
export async function isAnyDeckOpen(): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks?.query) return false
  try {
    const { held = [] } = await locks.query()
    return held.some((l) => l.name?.startsWith('opendeck-deck:'))
  } catch {
    return true // unsure: behave as if one is open
  }
}
