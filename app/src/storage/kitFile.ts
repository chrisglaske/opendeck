/**
 * Brand kit files (.odtheme): a kit's theme plus the logo images and uploaded font files it uses,
 * so someone else gets exactly the same look. Imports are treated as foreign data: the theme is
 * sanitized, every image and font is checked by its bytes, and nothing already stored is replaced.
 */
import { importFontData } from '../fonts/uploadedFonts'
import type { BrandKit } from '../model/brandKit'
import { newId } from '../model/ids'
import { sanitizeTheme } from '../model/sanitize'
import { compressImage } from './assets'
import type { SaveErrorReason } from './autosave'
import type { DeckStore } from './deckStore'
import { saveKit } from './kits'

export const KIT_FORMAT = 'opendeck-theme'
export const KIT_VERSION = 1
export const KIT_MAX_BYTES = 30 * 1024 * 1024
/** A theme has at most two logos; a few spare entries are tolerated, the rest ignored. */
const MAX_ASSETS = 8
const MAX_FONTS = 32

export type KitImportError = 'not-a-kit' | 'newer-version' | 'too-large'

type KitAsset = { id: string; type: string; width: number; height: number; data: string }
type KitFont = { family: string; weight: string; style: string; format: string; fileName: string; data: string }

// ── Base64, in chunks so large files never hit argument-count limits ─────

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}

function fromBase64(s: string): Uint8Array | null {
  try {
    const bin = atob(s)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

/** The image type from the file's first bytes; null for anything else (SVG included). */
function sniffImageType(b: Uint8Array): string | null {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x)
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  return null
}

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

export async function exportKitFile(store: DeckStore, kit: BrandKit): Promise<Blob> {
  const assets: KitAsset[] = []
  for (const id of new Set([kit.theme.logo.main, kit.theme.logo.dark].filter((x): x is string => !!x))) {
    const a = await store.getAsset(id)
    if (a) assets.push({ id, type: a.type, width: a.width, height: a.height, data: toBase64(await bytesOf(a.blob)) })
  }
  const families = new Set([kit.theme.fonts.heading, kit.theme.fonts.body])
  const fonts: KitFont[] = (await store.listFonts())
    .filter((f) => families.has(f.family))
    .map((f) => ({ family: f.family, weight: f.weight, style: f.style, format: f.format, fileName: f.fileName, data: toBase64(new Uint8Array(f.data)) }))
  const file = { format: KIT_FORMAT, version: KIT_VERSION, theme: kit.theme, assets, fonts }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Checks, compresses and stores one logo image under a new id; null when it isn't a usable image. */
async function importLogo(store: DeckStore, raw: unknown): Promise<string | null> {
  if (!isObj(raw) || typeof raw.data !== 'string') return null
  const bytes = fromBase64(raw.data)
  const type = bytes && sniffImageType(bytes)
  if (!bytes || !type) return null
  try {
    const img = await compressImage(new Blob([bytes as BlobPart], { type }))
    const id = newId()
    await store.putAsset({ id, blob: img.blob, type: img.type, width: img.width, height: img.height }).catch(() => {})
    return (await store.getAsset(id)) ? id : null
  } catch {
    return null
  }
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
    const id = entry ? await importLogo(store, entry) : null
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
