import type { FontSource } from '../fonts/uploadedFonts'

const NAME = 'opendeck-slides'
const FEATURES = 'popup,width=1280,height=760'

/**
 * Opens the second window of a show (the slides, or the speaker view) as an empty pop-up that
 * this page then draws into. Call it straight from the click, or the browser blocks it.
 * Null when it was blocked.
 */
export function openSlidesWindow(): Window | null {
  try {
    return window.open('', NAME, FEATURES)
  } catch {
    return null
  }
}

/** Gives a pop-up the uploaded fonts (it has its own font set). */
export function addPopupFonts(win: Window, fonts: readonly FontSource[]) {
  const doc = win.document
  const FontFaceCtor = (win as Window & { FontFace?: typeof FontFace }).FontFace
  for (const f of fonts) {
    if (!FontFaceCtor) break
    try {
      const face = new FontFaceCtor(f.family, f.data.slice(0), { weight: f.weight, style: f.style })
      doc.fonts.add(face)
      void face.load?.().catch(() => {})
    } catch {
      // A face the browser won't take here falls back like a missing font.
    }
  }
}

/**
 * Readies a pop-up for this page to draw into: the same stylesheets, light/dark mode and
 * uploaded fonts as here, and the given title. Returns the element to render into.
 */
export function preparePopup(win: Window, title: string, fonts: readonly FontSource[]): HTMLElement {
  const doc = win.document
  // A reused window still holds the last show; start clean.
  doc.head.replaceChildren()
  doc.body.replaceChildren()
  for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) doc.head.append(doc.importNode(node, true))
  doc.title = title
  const mode = document.documentElement.dataset.mode
  if (mode) doc.documentElement.dataset.mode = mode
  addPopupFonts(win, fonts)
  doc.body.style.margin = '0'
  doc.body.style.background = '#000'
  const mount = doc.createElement('div')
  mount.style.position = 'fixed'
  mount.style.inset = '0'
  doc.body.append(mount)
  return mount
}

/**
 * Calls `onClosed` once when the pop-up is closed (checked every second), and closes the
 * pop-up when this page goes away (reload, tab closed). Given the `mount` drawn into, it also
 * notices when the pop-up was reloaded (a fresh empty page) and calls `onReloaded`, so the show
 * can draw into it again; a pop-up this page can no longer reach counts as closed.
 * Returns a function that stops watching.
 */
export function watchClosed(
  win: Window,
  onClosed: () => void,
  opts: { mount?: HTMLElement; onReloaded?(): void } = {},
): () => void {
  const timer = setInterval(() => {
    let state: 'open' | 'closed' | 'reloaded' = 'open'
    if (win.closed) state = 'closed'
    else if (opts.mount) {
      try {
        if (win.document !== opts.mount.ownerDocument) state = opts.onReloaded ? 'reloaded' : 'closed'
      } catch {
        state = 'closed'
      }
    }
    if (state === 'open') return
    clearInterval(timer)
    if (state === 'reloaded') opts.onReloaded!()
    else onClosed()
  }, 1000)
  const onHide = () => win.close()
  window.addEventListener('pagehide', onHide)
  return () => {
    clearInterval(timer)
    window.removeEventListener('pagehide', onHide)
  }
}
