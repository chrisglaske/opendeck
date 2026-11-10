import { isSafeHref } from '../../model/sanitize'

const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/
const ADDRESS = /^[^\s/:@]+\.[^\s/:@]{2,}([/?#]\S*)?$/

/**
 * Turns what was typed into a link OpenDeck allows (web or email), or null.
 * A bare address gets `https://`, a bare email gets `mailto:`.
 */
export function normalizeLink(input: string): string | null {
  const v = input.trim()
  if (!v) return null
  let href = v
  if (!SCHEME.test(v)) {
    if (EMAIL.test(v)) href = `mailto:${v}`
    else if (ADDRESS.test(v)) href = `https://${v}`
    else return null
  }
  if (/^https?:\/\/$/i.test(href)) return null
  return isSafeHref(href) ? href : null
}
