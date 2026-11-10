import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakePopup, reloadPopup } from './fakePopup'
import { openSlidesWindow, preparePopup, watchClosed } from './popup'

afterEach(() => {
  document.head.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('popup', () => {
  it('opens a named pop-up window', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    expect(openSlidesWindow()).toBeNull()
    expect(open).toHaveBeenCalledWith('', 'opendeck-slides', expect.stringContaining('popup'))
  })

  it('copies the styles, title, mode and fonts into the pop-up', () => {
    document.head.innerHTML = '<style>.a{}</style><link rel="stylesheet" href="/x.css"><meta name="n">'
    document.documentElement.dataset.mode = 'dark'
    const win = fakePopup()
    win.document.head.innerHTML = '<style>.old{}</style>'
    const mount = preparePopup(win, 'Slides · Q3', [{ family: 'Brand', weight: '400', style: 'normal', data: new ArrayBuffer(8) }])
    expect(win.document.title).toBe('Slides · Q3')
    expect(win.document.head.querySelectorAll('style, link[rel=stylesheet]')).toHaveLength(2)
    expect(win.document.head.textContent).not.toContain('.old')
    expect(win.document.documentElement.dataset.mode).toBe('dark')
    expect(win.fontsAdded.map((f) => f.family)).toEqual(['Brand'])
    expect(mount.ownerDocument).toBe(win.document)
    delete document.documentElement.dataset.mode
  })

  it('notices when the pop-up is closed', () => {
    vi.useFakeTimers()
    const win = fakePopup()
    const onClosed = vi.fn()
    const stop = watchClosed(win, onClosed)
    win.closed = true
    vi.advanceTimersByTime(1000)
    expect(onClosed).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000)
    expect(onClosed).toHaveBeenCalledTimes(1)
    stop()
  })

  it('notices when the pop-up is reloaded, so the show can draw into it again', () => {
    vi.useFakeTimers()
    const win = fakePopup()
    const mount = preparePopup(win, 'Slides', [])
    const onClosed = vi.fn()
    const onReloaded = vi.fn()
    const stop = watchClosed(win, onClosed, { mount, onReloaded })
    vi.advanceTimersByTime(3000)
    expect(onReloaded).not.toHaveBeenCalled()
    reloadPopup(win)
    vi.advanceTimersByTime(1000)
    expect(onReloaded).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000)
    expect(onReloaded).toHaveBeenCalledTimes(1)
    expect(onClosed).not.toHaveBeenCalled()
    stop()
  })

  it('treats a pop-up it can no longer reach (moved to another site) as closed', () => {
    vi.useFakeTimers()
    const win = fakePopup()
    const mount = preparePopup(win, 'Slides', [])
    const onClosed = vi.fn()
    const stop = watchClosed(win, onClosed, { mount, onReloaded: () => {} })
    Object.defineProperty(win, 'document', { get() { throw new DOMException('Blocked', 'SecurityError') } })
    vi.advanceTimersByTime(1000)
    expect(onClosed).toHaveBeenCalledTimes(1)
    stop()
  })

  it('closes the pop-up when this page goes away', () => {
    const win = fakePopup()
    const stop = watchClosed(win, () => {})
    window.dispatchEvent(new Event('pagehide'))
    expect(win.closed).toBe(true)
    stop()
  })
})
