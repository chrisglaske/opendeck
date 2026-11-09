/** One `@font-face` as the page declares it. `src` is the font file's absolute URL. */
export type FaceRule = { family: string; src: string; unicodeRange?: string; weight?: string; style?: string }

type Range = [number, number]

/** "U+0000-00FF, U+0131, U+4??" → code point ranges. */
function parseRanges(value: string): Range[] {
  const out: Range[] = []
  for (const part of value.split(',')) {
    const m = part.trim().match(/^u\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i)
    if (!m) continue
    if (m[1].includes('?')) {
      out.push([parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'f'), 16)])
    } else {
      const lo = parseInt(m[1], 16)
      out.push([lo, m[2] ? parseInt(m[2], 16) : lo])
    }
  }
  return out
}

const unquote = (s: string) => s.trim().replace(/^(['"])(.*)\1$/, '$2')

/**
 * The faces a file needs: those of the families in use (a bundled family registers as
 * "<name> Variable") whose character range covers some of the text. A face with no range
 * covers everything.
 */
export function pickFontFaces<T extends FaceRule>(rules: readonly T[], families: readonly string[], text: string): T[] {
  const wanted = new Set(families.flatMap((f) => [f, `${f} Variable`]))
  const points = new Set<number>()
  for (const ch of text) points.add(ch.codePointAt(0)!)
  return rules.filter((r) => {
    if (!wanted.has(unquote(r.family))) return false
    if (!r.unicodeRange) return true
    const ranges = parseRanges(r.unicodeRange)
    if (ranges.length === 0) return true
    for (const p of points) if (ranges.some(([lo, hi]) => p >= lo && p <= hi)) return true
    return false
  })
}

/** The `@font-face` rules of the page's own stylesheets (the fonts that ship with OpenDeck). */
export function bundledFaceRules(doc: Document): FaceRule[] {
  const out: FaceRule[] = []
  const visit = (rules: CSSRuleList, base: string) => {
    for (const rule of Array.from(rules)) {
      if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) visit((rule as CSSGroupingRule).cssRules, base)
      if (rule.constructor.name !== 'CSSFontFaceRule' && !rule.cssText.startsWith('@font-face')) continue
      const style = (rule as CSSFontFaceRule).style
      const src = style.getPropertyValue('src').match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/)
      const family = style.getPropertyValue('font-family')
      if (!src || !family) continue
      let url: string
      try { url = new URL(src[2], base).href } catch { continue }
      const face: FaceRule = { family: unquote(family), src: url }
      const range = style.getPropertyValue('unicode-range')
      const weight = style.getPropertyValue('font-weight')
      const fstyle = style.getPropertyValue('font-style')
      if (range) face.unicodeRange = range
      if (weight) face.weight = weight
      if (fstyle) face.style = fstyle
      out.push(face)
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue } // another site's sheet
    visit(rules, sheet.href ?? doc.baseURI)
  }
  return out
}
