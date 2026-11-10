/**
 * Deck files (.odeck): one deck plus the pictures and uploaded font files it uses. Imports are
 * treated as foreign data: the deck is sanitized, every picture and font is checked by its bytes,
 * and the deck always arrives as a new deck with new ids, so nothing stored is ever replaced.
 * Folder, tags and pin stay in the library and are not part of the file.
 */
import { importFontData } from '../fonts/uploadedFonts'
import { safeFileName } from '../editor/download'
import { withAssetLock } from './assets'
import { emptyEntry } from '../home/library'
import { withNewIds } from '../home/libraryService'
import { newId } from '../model/ids'
import { sanitizeDeck } from '../model/sanitize'
import type { Deck, ImageEl, SlideElement } from '../model/types'
import { errorReason } from './autosave'
import type { SaveErrorReason } from './autosave'
import type { DeckStore } from './deckStore'
import { exportImageEntry, fromBase64, importImageEntry, isObj, toBase64 } from './fileData'
import type { FileAsset } from './fileData'

export const DECK_FILE_FORMAT = 'opendeck-deck'
export const DECK_FILE_VERSION = 1
export const DECK_FILE_MAX_BYTES = 60 * 1024 * 1024
/** Pictures and fonts read from one file; the rest are ignored. */
const MAX_ASSETS = 1000
const MAX_FONTS = 64

export type DeckImportResult =
  | { ok: true; deckId: string; notSaved?: SaveErrorReason }
  | { ok: false; reason: 'not-a-deck' | 'newer-version' | 'too-large' }

/** Turns a V1 project into a stored V2 deck; null when it can't. */
export type ConvertV1 = (raw: unknown) => Promise<DeckImportResult> | null

type DeckFont = { family: string; weight: string; style: string; format: string; fileName: string; data: string }

/** A file name for a deck, from its name in any language, ending in .odeck. */
export const deckFileName = (name: string) => safeFileName(name, 'deck', '.odeck')

function eachElement(els: SlideElement[], fn: (el: SlideElement) => void) {
  for (const el of els) {
    fn(el)
    if (el.type === 'group') eachElement(el.children, fn)
  }
}

/** Every stored picture the deck uses: images (not sample art), slide backgrounds and theme logos. */
export function deckAssetIds(d: Deck): string[] {
  const ids = new Set<string>()
  for (const s of d.slides) {
    eachElement(s.elements, (el) => {
      if (el.type === 'image' && el.assetId && !el.art) ids.add(el.assetId)
    })
    if (s.background.imageId) ids.add(s.background.imageId)
  }
  if (d.theme.logo.main) ids.add(d.theme.logo.main)
  if (d.theme.logo.dark) ids.add(d.theme.logo.dark)
  return [...ids]
}

/** Every font family the deck asks for: the theme's two and any set by hand on text. */
export function deckFontFamilies(d: Deck): Set<string> {
  const out = new Set([d.theme.fonts.heading, d.theme.fonts.body])
  for (const s of d.slides) {
    eachElement(s.elements, (el) => {
      if (el.type === 'text' && el.fontFamily) out.add(el.fontFamily)
    })
  }
  return out
}

export async function exportDeckFile(store: DeckStore, deck: Deck): Promise<Blob> {
  const assets: FileAsset[] = []
  for (const id of deckAssetIds(deck)) {
    const a = await exportImageEntry(store, id)
    if (a) assets.push(a)
  }
  const families = deckFontFamilies(deck)
  const fonts: DeckFont[] = (await store.listFonts())
    .filter((f) => families.has(f.family))
    .map((f) => ({ family: f.family, weight: f.weight, style: f.style, format: f.format, fileName: f.fileName, data: toBase64(new Uint8Array(f.data)) }))
  const file = { format: DECK_FILE_FORMAT, version: DECK_FILE_VERSION, deck, assets, fonts }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

const isV1Project = (raw: unknown): boolean =>
  isObj(raw) && typeof raw.id === 'string' && isObj(raw.data) && Array.isArray(raw.data.slides)

/**
 * Adds a deck from a file: a V2 deck file, or a V1 project handed to `convertV1`. Always a new
 * deck with a new, empty library entry (no folder, not pinned).
 */
export function importDeckFile(store: DeckStore, file: File, convertV1: ConvertV1, now: number): Promise<DeckImportResult> {
  // Pictures are stored before the record that uses them; clean-up in another tab waits.
  return withAssetLock(() => importDeckFileLocked(store, file, convertV1, now))
}

async function importDeckFileLocked(store: DeckStore, file: File, convertV1: ConvertV1, now: number): Promise<DeckImportResult> {
  if (file.size > DECK_FILE_MAX_BYTES) return { ok: false, reason: 'too-large' }
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return { ok: false, reason: 'not-a-deck' }
  }
  if (isV1Project(raw)) return (await convertV1(raw)) ?? { ok: false, reason: 'not-a-deck' }
  if (!isObj(raw) || raw.format !== DECK_FILE_FORMAT || typeof raw.version !== 'number') return { ok: false, reason: 'not-a-deck' }
  if (raw.version > DECK_FILE_VERSION) return { ok: false, reason: 'newer-version' }
  if (raw.version !== DECK_FILE_VERSION) return { ok: false, reason: 'not-a-deck' }
  const r = sanitizeDeck(raw.deck)
  if (!r.ok) return { ok: false, reason: r.reason }
  const src = r.deck

  const entries = Array.isArray(raw.assets) ? raw.assets.slice(0, MAX_ASSETS) : []
  // Each picture is imported once, however many times the deck uses it.
  const imported = new Map<string, Promise<string | null>>()
  let notSaved: SaveErrorReason | undefined
  const bring = (oldId: string) => {
    let p = imported.get(oldId)
    if (!p) {
      const entry = entries.find((a) => isObj(a) && a.id === oldId)
      p = entry
        ? importImageEntry(store, entry).then((res) => {
            notSaved ??= res?.notSaved
            return res?.id ?? null
          })
        : Promise.resolve(null)
      imported.set(oldId, p)
    }
    return p
  }

  const deck: Deck = {
    ...src,
    id: newId(),
    slides: src.slides.map((s) => ({ ...s, id: newId(), elements: s.elements.map(withNewIds) })),
    createdAt: now,
    updatedAt: now,
  }
  for (const s of deck.slides) {
    const images: ImageEl[] = []
    eachElement(s.elements, (el) => {
      if (el.type === 'image' && el.assetId && !el.art) images.push(el)
    })
    for (const el of images) {
      const id = await bring(el.assetId)
      if (id) el.assetId = id
      else {
        el.assetId = ''
        el.art = { kind: 'photo', variant: 0 }
        el.sample = true
      }
    }
    const bg = s.background.imageId
    if (bg) {
      const id = await bring(bg)
      s.background = id ? { ...s.background, imageId: id } : { color: s.background.color }
    }
  }
  const logo: Deck['theme']['logo'] = {}
  for (const slot of ['main', 'dark'] as const) {
    const oldId = deck.theme.logo[slot]
    const id = oldId ? await bring(oldId) : null
    if (id) logo[slot] = id
  }
  deck.theme = { ...deck.theme, logo }

  const fonts = Array.isArray(raw.fonts) ? raw.fonts.slice(0, MAX_FONTS) : []
  for (const f of fonts) {
    if (!isObj(f) || typeof f.fileName !== 'string' || typeof f.data !== 'string') continue
    const bytes = fromBase64(f.data)
    if (!bytes) continue
    const res = await importFontData(store, f.fileName.slice(0, 200), bytes.buffer as ArrayBuffer, { replace: false })
    if (res.ok) notSaved ??= res.notSaved
  }

  try {
    await store.putDeck(deck)
  } catch (e) {
    // The deck still opens in this tab; the editor shows why it isn't saved.
    return { ok: true, deckId: deck.id, notSaved: errorReason(e) }
  }
  try {
    await store.putLibrary(emptyEntry(deck.id))
  } catch (e) {
    notSaved ??= errorReason(e)
  }
  return notSaved ? { ok: true, deckId: deck.id, notSaved } : { ok: true, deckId: deck.id }
}
