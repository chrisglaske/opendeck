import type { Deck } from '../model/types'
import { getDeckStore } from '../storage/appStore'
import { deckFontFamilies } from '../storage/deckFile'
import { bundledFaceRules, pickFontFaces } from './fontFaces'
import type { FaceRule } from './fontFaces'
import { buildHtmlFile } from './htmlFile'
import type { FileFontFace } from './htmlFile'

/** The speaker view's own fonts (see --font-ui and --font-display), so it looks as it does in the app. */
const UI_FAMILIES = ['Inter', 'Manrope']

const MIME: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', truetype: 'font/ttf', opentype: 'font/otf' }

let player: Promise<{ js: string; css: string }> | null = null

/** The built player, fetched once from this site. */
function loadPlayer(): Promise<{ js: string; css: string }> {
  player ??= fetch(`${import.meta.env.BASE_URL}player-bundle.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`player ${r.status}`)
      return r.json() as Promise<{ js: string; css: string }>
    })
    .catch((e: unknown) => {
      player = null
      throw e
    })
  return player
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`font ${r.status}`)
  return r.arrayBuffer()
}

/**
 * Fetches the app's own font files for the file. A face that can't be fetched (say, a tab
 * left open across a site update) is left out; the text then falls back to the next font.
 */
export async function fetchBundledFaces(rules: readonly FaceRule[]): Promise<FileFontFace[]> {
  const results = await Promise.allSettled(
    rules.map(async (r): Promise<FileFontFace> => ({ family: r.family, weight: r.weight, style: r.style, unicodeRange: r.unicodeRange, data: await fetchBytes(r.src), type: 'font/woff2' })),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}

/** Makes the downloadable HTML file for a deck from what this browser has: pictures, fonts and the player. */
export async function makeHtmlFile(deck: Deck): Promise<Blob> {
  const store = await getDeckStore()
  const visible = deck.slides.filter((s) => !s.hidden)
  const families = [...deckFontFamilies({ ...deck, slides: visible })]
  // Every character the slides and notes could show decides which language subsets come along.
  const text = JSON.stringify(visible) + deck.name
  const bundled = pickFontFaces(bundledFaceRules(document), [...families, ...UI_FAMILIES], text)
  const fontFaces = await fetchBundledFaces(bundled)
  const wanted = new Set(families)
  for (const f of await store.listFonts()) {
    if (wanted.has(f.family)) fontFaces.push({ family: f.family, weight: f.weight, style: f.style, data: f.data, type: MIME[f.format] ?? 'font/woff2' })
  }
  return buildHtmlFile(deck, {
    loadAsset: async (id) => (await store.getAsset(id))?.blob ?? null,
    fontFaces,
    player: await loadPlayer(),
  })
}
