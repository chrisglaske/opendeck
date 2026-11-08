import type { Theme } from './theme'

/** A saved set of colors, fonts, corners and logo. Its theme's `id` is the kit id and its `source` is null. */
export type BrandKit = { id: string; theme: Theme; createdAt: number; updatedAt: number }
