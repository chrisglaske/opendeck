/**
 * Fonts people upload. Each face is checked (extension, file signature, and the browser
 * actually loading it), saved in this browser, and registered with `document.fonts` under its
 * family name, which `fontStack` in model/theme already tries.
 */
import { useSyncExternalStore } from 'react'
import { newId } from '../model/ids'
import type { DeckStore, StoredFont } from '../storage/deckStore'
import { errorReason } from '../storage/autosave'
import type { SaveErrorReason } from '../storage/autosave'
import { FONT_MAX_BYTES, hasFontExtension, parseFontFileName, sniffFontFormat } from './fontFile'
import type { FontStyle } from './fontFile'

export type FontImportResult =
  | { ok: true; family: string; faces: string[]; bytes: number; notSaved?: SaveErrorReason }
  | { ok: false; fileName: string; reason: 'not-a-font' | 'too-large' }

// ── Registry of faces usable in this tab ─────────────────────────────────

type Face = { id: string; family: string; weight: string; style: FontStyle; data: ArrayBuffer; font: FontFace }
const registry = new Map<string, Face>()
const listeners = new Set<() => void>()
let snapshot: { families: string[]; faces: Record<string, string[]> } = { families: [], faces: {} }

const faceKey = (family: string, weight: string, style: FontStyle) => `${family}|${weight}|${style}`
/** How a face is listed: its weight, plus " italic" for italic faces. */
const faceName = (weight: string, style: FontStyle) => (style === 'italic' ? `${weight} italic` : weight)
const byWeight = (a: string, b: string) => parseInt(a) - parseInt(b) || a.localeCompare(b)

function publish() {
  const faces: Record<string, string[]> = {}
  for (const f of registry.values()) (faces[f.family] ??= []).push(faceName(f.weight, f.style))
  for (const list of Object.values(faces)) list.sort(byWeight)
  snapshot = { families: Object.keys(faces).sort((a, b) => a.localeCompare(b)), faces }
  for (const l of listeners) l()
}

function addFace(face: Omit<Face, 'font'>, font: FontFace) {
  const key = faceKey(face.family, face.weight, face.style)
  const old = registry.get(key)
  if (old) document.fonts.delete(old.font)
  document.fonts.add(font)
  registry.set(key, { ...face, font })
}

/** Uploaded families usable in this tab, and each family's faces ("400", "700 italic", …). */
export function useUploadedFonts(): { families: string[]; faces: Record<string, string[]> } {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}

export const uploadedFamilies = (): ReadonlySet<string> => new Set(snapshot.families)

/** An uploaded face's bytes, for drawing it somewhere else: the slides window or a downloaded file. */
export type FontSource = { family: string; weight: string; style: FontStyle; data: ArrayBuffer }

/** Every uploaded face registered in this tab. */
export function uploadedFontSources(): FontSource[] {
  return [...registry.values()].map(({ family, weight, style, data }) => ({ family, weight, style, data }))
}

/** Forgets every registered face. For tests. */
export function resetUploadedFonts() {
  for (const f of registry.values()) document.fonts.delete(f.font)
  registry.clear()
  publish()
}

// ── Loading ──────────────────────────────────────────────────────────────

const WEIGHT = /^([1-9]00)( [1-9]00)?$/
const FAMILY = /^[A-Za-z0-9 ._-]{1,64}$/

async function load(family: string, data: ArrayBuffer, weight: string, style: FontStyle): Promise<FontFace | null> {
  try {
    const font = new FontFace(family, data, { weight, style })
    await font.load()
    return font
  } catch {
    return null
  }
}

/** Registers faces saved earlier. Anything malformed or unloadable is skipped. */
export async function registerStoredFonts(fonts: readonly unknown[]): Promise<void> {
  for (const raw of fonts) {
    if (typeof raw !== 'object' || raw === null) continue
    const f = raw as Partial<StoredFont>
    if (
      typeof f.id !== 'string' || typeof f.family !== 'string' || !FAMILY.test(f.family)
      || typeof f.weight !== 'string' || !WEIGHT.test(f.weight) || (f.style !== 'normal' && f.style !== 'italic')
      || !(f.data instanceof ArrayBuffer) || f.data.byteLength > FONT_MAX_BYTES
    ) continue
    const font = await load(f.family, f.data, f.weight, f.style)
    if (font) addFace({ id: f.id, family: f.family, weight: f.weight, style: f.style, data: f.data }, font)
  }
  publish()
}

let started: Promise<void> | null = null
/** Registers the fonts saved in this browser, once per page. */
export function loadStoredFonts(store: Promise<DeckStore>): Promise<void> {
  started ??= store.then((s) => s.listFonts()).then(registerStoredFonts).catch(() => {})
  return started
}

/**
 * Checks, saves and registers one font file's bytes. Shared by uploads and brand kit import.
 * `replace` lets an upload overwrite the same face uploaded earlier; imports never overwrite.
 */
export async function importFontData(
  store: DeckStore, fileName: string, data: ArrayBuffer, opts: { replace: boolean } = { replace: true },
): Promise<{ ok: true; family: string; face: string; bytes: number; notSaved?: SaveErrorReason } | { ok: false; reason: 'not-a-font' | 'too-large' }> {
  if (!hasFontExtension(fileName)) return { ok: false, reason: 'not-a-font' }
  if (data.byteLength > FONT_MAX_BYTES) return { ok: false, reason: 'too-large' }
  const format = sniffFontFormat(new Uint8Array(data, 0, Math.min(4, data.byteLength)))
  if (!format) return { ok: false, reason: 'not-a-font' }
  const { family, weight, style } = parseFontFileName(fileName)
  const existing = registry.get(faceKey(family, weight, style))
  const result = { ok: true as const, family, face: faceName(weight, style), bytes: data.byteLength }
  if (existing && !opts.replace) return result
  const font = await load(family, data, weight, style)
  if (!font) return { ok: false, reason: 'not-a-font' }
  const stored: StoredFont = { id: existing?.id ?? newId(), family, weight, style, format, data, fileName, size: data.byteLength }
  addFace(stored, font)
  publish()
  try {
    await store.putFont(stored)
    return result
  } catch (e) {
    return { ...result, notSaved: errorReason(e) }
  }
}

/** Uploads font files: one result per family (faces of the same family merge) and one per failed file. */
export async function importFontFiles(store: DeckStore, files: readonly File[]): Promise<FontImportResult[]> {
  const failed: FontImportResult[] = []
  const families = new Map<string, { faces: Set<string>; bytes: number; notSaved?: SaveErrorReason }>()
  for (const file of files) {
    if (!hasFontExtension(file.name)) { failed.push({ ok: false, fileName: file.name, reason: 'not-a-font' }); continue }
    if (file.size > FONT_MAX_BYTES) { failed.push({ ok: false, fileName: file.name, reason: 'too-large' }); continue }
    const r = await importFontData(store, file.name, await file.arrayBuffer())
    if (!r.ok) { failed.push({ ok: false, fileName: file.name, reason: r.reason }); continue }
    const fam = families.get(r.family) ?? { faces: new Set<string>(), bytes: 0 }
    fam.faces.add(r.face)
    fam.bytes += r.bytes
    fam.notSaved ??= r.notSaved
    families.set(r.family, fam)
  }
  const ok: FontImportResult[] = [...families].map(([family, f]) => ({
    ok: true, family, faces: [...f.faces].sort(byWeight), bytes: f.bytes, ...(f.notSaved ? { notSaved: f.notSaved } : {}),
  }))
  return [...ok, ...failed]
}

const WEIGHT_NAMES: Record<string, string> = {
  '100': 'Thin', '200': 'ExtraLight', '300': 'Light', '400': 'Regular', '500': 'Medium',
  '600': 'SemiBold', '700': 'Bold', '800': 'ExtraBold', '900': 'Black',
}

/** "Regular", "Bold Italic", "Variable", … */
export function faceLabel(weight: string, style: FontStyle): string {
  const name = weight.includes(' ') ? 'Variable' : WEIGHT_NAMES[weight] ?? weight
  return style === 'italic' ? `${name} Italic` : name
}
