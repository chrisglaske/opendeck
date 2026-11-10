import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import type { Deck } from '../model/types'
import { AssetLoaderContext, defaultAssetLoader } from '../storage/assets'
import type { AssetLoader } from '../storage/assets'
import { PrintLayout } from './PrintLayout'

/** Never keep someone waiting longer than this for a picture or font before printing. */
export const PRINT_WAIT_CAP_MS = 10_000

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/** Resolves once every picture the layout asked for has arrived and drawn (or failed), and fonts are in. */
async function settled(root: HTMLElement, pending: Set<Promise<unknown>>): Promise<void> {
  for (;;) {
    await tick()
    if (pending.size) {
      await Promise.allSettled([...pending])
      continue
    }
    const waiting = [...root.querySelectorAll('img')].filter((img) => !img.complete)
    if (waiting.length === 0) break
    await Promise.all(waiting.map((img) => new Promise((r) => {
      img.addEventListener('load', r, { once: true })
      img.addEventListener('error', r, { once: true })
    })))
  }
  await document.fonts?.ready
}

/**
 * Pages are slide-sized, so a slide prints edge to edge at its real size and text stays text.
 * Applied only while printing a deck, so the browser's own Print elsewhere keeps its paper size.
 * Built through the CSSOM, which the page's strict CSP allows.
 */
function addSlidePageSize(): () => void {
  if (typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in document)) return () => {}
  const sheet = new CSSStyleSheet()
  sheet.replaceSync('@page { size: 1920px 1080px; margin: 0; }')
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  return () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet)
  }
}

/** Undoes the last printDeck, if its print window never reported closing. */
let undoLastPrint: (() => void) | null = null

/**
 * Opens the browser's print window with the deck laid out one slide per page, so "Save as PDF"
 * there makes the PDF. The layout is removed once the print window closes.
 */
export async function printDeck(deck: Deck, opts: { loadAsset?: AssetLoader } = {}): Promise<void> {
  undoLastPrint?.()
  document.getElementById('print-root')?.remove()
  const host = document.createElement('div')
  host.id = 'print-root'
  document.body.append(host)

  const load = opts.loadAsset ?? defaultAssetLoader
  const pending = new Set<Promise<unknown>>()
  const tracked: AssetLoader = (id) => {
    const p = load(id)
    pending.add(p)
    void p.finally(() => pending.delete(p)).catch(() => {})
    return p
  }

  const root = createRoot(host)
  flushSync(() => root.render(createElement(AssetLoaderContext.Provider, { value: tracked }, createElement(PrintLayout, { deck }))))

  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    settled(host, pending),
    new Promise<void>((r) => { timer = setTimeout(r, PRINT_WAIT_CAP_MS) }),
  ])
  clearTimeout(timer)

  // Browsers name the PDF after the page title.
  const title = document.title
  let removePageSize = () => {}
  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup)
    if (undoLastPrint === cleanup) undoLastPrint = null
    removePageSize()
    document.title = title
    delete document.documentElement.dataset.printing
    root.unmount()
    host.remove()
  }
  undoLastPrint = cleanup
  window.addEventListener('afterprint', cleanup, { once: true })
  removePageSize = addSlidePageSize()
  document.title = deck.name
  // Only while this is set does the page hide everything but the slides when printing, so the
  // browser's own Print elsewhere in the app isn't blank.
  document.documentElement.dataset.printing = ''
  window.print()
}
