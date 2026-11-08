/** WCAG 2.x relative luminance of a `#RRGGBB` color. */
function luminance(hex: string): number {
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
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Custom properties declared in the first rule whose selector contains
 * `data-mode="<mode>"`. Keys keep their leading `--`.
 */
export function readTokens(css: string, mode: 'light' | 'dark'): Record<string, string> {
  const rule = /([^{}]+)\{([^{}]*)\}/g
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, selector, body] of source.matchAll(rule)) {
    if (!selector.includes(`data-mode="${mode}"`)) continue
    const out: Record<string, string> = {}
    for (const decl of body.split(';')) {
      const i = decl.indexOf(':')
      const name = decl.slice(0, i).trim()
      if (i > 0 && name.startsWith('--')) out[name] = decl.slice(i + 1).trim()
    }
    return out
  }
  throw new Error(`No rule for data-mode="${mode}"`)
}
