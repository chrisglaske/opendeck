/**
 * Brand kit files (.odtheme): a kit's theme plus the logo images and uploaded font files it uses,
 * so someone else gets exactly the same look. Imports are treated as foreign data: the theme is
 * sanitized, every image and font is checked by its bytes, and nothing already stored is replaced.
 */
import { importFontData } from '../fonts/uploadedFonts'
import type { BrandKit } from '../model/brandKit'
import { sanitizeTheme } from '../model/sanitize'
import type { SaveErrorReason } from './autosave'
import type { DeckStore } from './deckStore'
import { exportImageEntry, fromBase64, importImageEntry, isObj, toBase64 } from './fileData'
import type { FileAsset } from './fileData'
import { saveKit } from './kits'

export const KIT_FORMAT = 'opendeck-theme'
export const KIT_VERSION = 1
export const KIT_MAX_BYTES = 30 * 1024 * 1024
/** A theme has at most two logos; a few spare entries are tolerated, the rest ignored. */
const MAX_ASSETS = 8
const MAX_FONTS = 32

export type KitImportError = 'not-a-kit' | 'newer-version' | 'too-large'

type KitFont = { family: string; weight: string; style: string; format: string; fileName: string; data: string }

export async function exportKitFile(store: DeckStore, kit: BrandKit): Promise<Blob> {
  const assets: FileAsset[] = []
  for (const id of new Set([kit.theme.logo.main, kit.theme.logo.dark].filter((x): x is string => !!x))) {
    const a = await exportImageEntry(store, id)
    if (a) assets.push(a)
  }
  const families = new Set([kit.theme.fonts.heading, kit.theme.fonts.body])
  const fonts: KitFont[] = (await store.listFonts())
    .filter((f) => families.has(f.family))
    .map((f) => ({ family: f.family, weight: f.weight, style: f.style, format: f.format, fileName: f.fileName, data: toBase64(new Uint8Array(f.data)) }))
  const file = { format: KIT_FORMAT, version: KIT_VERSION, theme: kit.theme, assets, fonts }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

/** Adds a brand kit from a file. Always a new kit; existing kits, images and fonts are never replaced. */
export async function importKitFile(
  store: DeckStore, file: File,
): Promise<{ ok: true; kit: BrandKit; notSaved?: SaveErrorReason } | { ok: false; reason: KitImportError }> {
  if (file.size > KIT_MAX_BYTES) return { ok: false, reason: 'too-large' }
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return { ok: false, reason: 'not-a-kit' }
  }
  if (!isObj(raw) || raw.format !== KIT_FORMAT || typeof raw.version !== 'number') return { ok: false, reason: 'not-a-kit' }
  if (raw.version > KIT_VERSION) return { ok: false, reason: 'newer-version' }
  if (raw.version !== KIT_VERSION || !isObj(raw.theme)) return { ok: false, reason: 'not-a-kit' }

  const theme = sanitizeTheme(raw.theme)
  const files = Array.isArray(raw.assets) ? raw.assets.slice(0, MAX_ASSETS) : []
  const logo: typeof theme.logo = {}
  for (const slot of ['main', 'dark'] as const) {
    const oldId = theme.logo[slot]
    const entry = oldId ? files.find((a) => isObj(a) && a.id === oldId) : undefined
    const id = entry ? await importImageEntry(store, entry) : null
    if (id) logo[slot] = id
  }
  theme.logo = logo

  const fonts = Array.isArray(raw.fonts) ? raw.fonts.slice(0, MAX_FONTS) : []
  for (const f of fonts) {
    if (!isObj(f) || typeof f.fileName !== 'string' || typeof f.data !== 'string') continue
    const bytes = fromBase64(f.data)
    if (bytes) await importFontData(store, f.fileName.slice(0, 200), bytes.buffer as ArrayBuffer, { replace: false })
  }

  const { kit, notSaved } = await saveKit(store, theme)
  return notSaved ? { ok: true, kit, notSaved } : { ok: true, kit }
}
