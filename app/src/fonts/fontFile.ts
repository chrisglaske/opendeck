import { isBundled } from './catalog'

export const FONT_MAX_BYTES = 2 * 1024 * 1024
export const FONT_EXTENSIONS = ['.woff2', '.woff', '.ttf', '.otf'] as const
export type FontFormat = 'woff2' | 'woff' | 'truetype' | 'opentype'
export type FontStyle = 'normal' | 'italic'

/** The font format from a file's first bytes, or null when it isn't a font. */
export function sniffFontFormat(bytes: Uint8Array): FontFormat | null {
  if (bytes.length < 4) return null
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  if (tag === 'wOF2') return 'woff2'
  if (tag === 'wOFF') return 'woff'
  if (tag === 'OTTO') return 'opentype'
  if (tag === 'true' || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return 'truetype'
  return null
}

export const hasFontExtension = (name: string) => FONT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))

/** Weight words, longest first so "extra bold" wins over "bold". Matched on lower-case words. */
const WEIGHTS: [string[], string][] = [
  [['extra', 'light'], '200'], [['ultra', 'light'], '200'], [['semi', 'bold'], '600'], [['demi', 'bold'], '600'],
  [['extra', 'bold'], '800'], [['ultra', 'bold'], '800'],
  [['extralight'], '200'], [['ultralight'], '200'], [['semibold'], '600'], [['demibold'], '600'],
  [['extrabold'], '800'], [['ultrabold'], '800'],
  [['thin'], '100'], [['hairline'], '100'], [['light'], '300'], [['regular'], '400'], [['book'], '400'], [['normal'], '400'],
  [['medium'], '500'], [['bold'], '700'], [['black'], '900'], [['heavy'], '900'],
  [['variable'], '100 900'], [['vf'], '100 900'],
]
const ITALIC = new Set(['italic', 'oblique'])

/**
 * Font family, weight and style read from a file name such as "AcmeSans-SemiBoldItalic.woff2".
 * The family keeps only letters, digits, spaces and dots, so it is always safe to use as a name.
 */
export function parseFontFileName(name: string): { family: string; weight: string; style: FontStyle } {
  const base = name.replace(/\.[A-Za-z0-9]+$/, '')
  const words = base
    .replace(/[^A-Za-z0-9 ._-]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_.-]+/)
    .filter(Boolean)
  let weight = '400'
  let style: FontStyle = 'normal'
  const kept: string[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase()
    if (ITALIC.has(w)) { style = 'italic'; continue }
    const hit = WEIGHTS.find(([parts]) => parts.every((p, j) => words[i + j]?.toLowerCase() === p))
    if (hit) {
      weight = hit[1]
      i += hit[0].length - 1
      continue
    }
    kept.push(words[i][0].toUpperCase() + words[i].slice(1))
  }
  let family = kept.join(' ').slice(0, 64).trim()
  if (!family) family = 'Uploaded font'
  else if (isBundled(family)) family = `${family} Uploaded`.slice(0, 64)
  return { family, weight, style }
}
