import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_KEY } from '../analytics/consent'
import { watchCountingOff } from './startup'

const beacon = vi.hoisted(() => ({ unload: vi.fn(() => true), reload: vi.fn(), load: vi.fn() }))
vi.mock('../analytics/beacon', () => ({ loadBeacon: beacon.load, unloadBeacon: beacon.unload, reloadPage: beacon.reload }))
vi.mock('../storage/appStore', () => ({ getDeckStore: () => new Promise(() => {}) }))

const otherTabSets = (value: string | null) => {
  if (value === null) localStorage.removeItem(CONSENT_KEY)
  else localStorage.setItem(CONSENT_KEY, value)
  window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY, newValue: value }))
}
const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('turning counting off in another tab', () => {
  let stop: () => void
  afterEach(() => { stop?.(); localStorage.clear(); beacon.reload.mockClear(); beacon.unload.mockClear(); beacon.unload.mockReturnValue(true); setHidden(false) })

  it('stops this tab counting too, once it is out of sight so nothing in view is interrupted', () => {
    stop = watchCountingOff()
    otherTabSets('declined')
    expect(beacon.reload).not.toHaveBeenCalled()
    setHidden(true)
    expect(beacon.reload).toHaveBeenCalledTimes(1)
  })

  it('reloads at once when this tab is already in the background', () => {
    setHidden(true)
    stop = watchCountingOff()
    otherTabSets('declined')
    expect(beacon.reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the counter was never loaded here', () => {
    beacon.unload.mockReturnValue(false)
    stop = watchCountingOff()
    otherTabSets('declined')
    setHidden(true)
    expect(beacon.reload).not.toHaveBeenCalled()
  })

  it('ignores other keys and a yes', () => {
    stop = watchCountingOff()
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'declined' }))
    otherTabSets('accepted')
    setHidden(true)
    expect(beacon.reload).not.toHaveBeenCalled()
  })
})
