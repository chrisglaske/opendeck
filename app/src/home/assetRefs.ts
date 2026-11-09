/**
 * Every picture id a stored record points to: `assetId` on images (at any group depth),
 * `imageId` on slide backgrounds, and the theme logo. Works on raw deck, template and brand
 * kit records without trusting their shape. It looks everywhere, so a picture is only ever
 * treated as unused when nothing could possibly point to it.
 */
export function assetRefsOf(raw: unknown): Set<string> {
  const refs = new Set<string>()
  const seen = new Set<object>()
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.length > 0) refs.add(v)
  }
  const walk = (v: unknown) => {
    if (typeof v !== 'object' || v === null || seen.has(v)) return
    seen.add(v)
    if (Array.isArray(v)) {
      v.forEach(walk)
      return
    }
    const o = v as Record<string, unknown>
    add(o.assetId)
    add(o.imageId)
    if (typeof o.logo === 'object' && o.logo !== null) {
      add((o.logo as Record<string, unknown>).main)
      add((o.logo as Record<string, unknown>).dark)
    }
    for (const child of Object.values(o)) walk(child)
  }
  walk(raw)
  return refs
}
