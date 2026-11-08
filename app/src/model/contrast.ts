/** WCAG 2.x relative luminance of a `#RRGGBB` color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`Expected #RRGGBB, got "${hex}"`)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio between two `#RRGGBB` colors (1–21). */
export function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [relativeLuminance(fg), relativeLuminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

/** `pct` of `a` mixed into `b` in sRGB, like CSS `color-mix(in srgb, a pct%, b)`. Returns `#RRGGBB`. */
export function mixHex(a: string, b: string, pct: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const p = pct / 100
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)).toString(16).padStart(2, '0'))
  return `#${out.join('')}`.toUpperCase()
}
