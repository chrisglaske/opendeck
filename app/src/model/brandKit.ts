import { sanitizeTheme } from './sanitize'
import type { Theme } from './theme'

/** A saved set of colors, fonts, corners and logo. Its theme's `id` is the kit id and its `source` is null. */
export type BrandKit = { id: string; theme: Theme; createdAt: number; updatedAt: number }

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)

/** The only way stored or imported data becomes a BrandKit; null when it can't be one. */
export function sanitizeKit(raw: unknown): BrandKit | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !SAFE_ID.test(r.id)) return null
  const theme = sanitizeTheme(r.theme)
  theme.id = r.id
  theme.source = null
  return { id: r.id, theme, createdAt: time(r.createdAt), updatedAt: time(r.updatedAt) }
}
