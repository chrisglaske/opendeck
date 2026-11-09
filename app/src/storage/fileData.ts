/** Helpers shared by the files OpenDeck exports and imports (brand kits, templates). */
import { newId } from '../model/ids'
import { compressImage } from './assets'
import type { DeckStore } from './deckStore'

/** Base64, in chunks so large files never hit argument-count limits. */
export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}

export function fromBase64(s: string): Uint8Array | null {
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
export function sniffImageType(b: Uint8Array): string | null {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x)
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  return null
}

export const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** One picture as a file carries it. */
export type FileAsset = { id: string; type: string; width: number; height: number; data: string }

/** A stored picture, ready to go into a file; null when it isn't stored. */
export async function exportImageEntry(store: DeckStore, id: string): Promise<FileAsset | null> {
  const a = await store.getAsset(id)
  return a ? { id, type: a.type, width: a.width, height: a.height, data: toBase64(await bytesOf(a.blob)) } : null
}

/**
 * Checks, compresses and stores one picture from a file under a new id, so nothing stored is
 * replaced. Null when it isn't a usable image (checked by its bytes, whatever it claims to be).
 */
export async function importImageEntry(store: DeckStore, raw: unknown): Promise<string | null> {
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
