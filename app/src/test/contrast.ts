export { contrastRatio, relativeLuminance } from '../model/contrast'

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
