import { describe, expect, it } from 'vitest'
import { bundlePlayer, inlineSafeJs } from './player.ts'

describe('inlineSafeJs', () => {
  it('escapes closing script tags', () => {
    expect(inlineSafeJs('a("</script>")')).toBe('a("<\\/script>")')
  })

  it('refuses a player that contains <!--', () => {
    expect(() => inlineSafeJs('a("<!--<script>")')).toThrow(/<!--/)
  })
})

describe('bundlePlayer', () => {
  it('builds one script and one stylesheet with no outside URLs', async () => {
    const { js, css } = await bundlePlayer()
    expect(js.length).toBeGreaterThan(1000)
    expect(css.length).toBeGreaterThan(100)
    for (const text of [js, css]) {
      expect(text).not.toContain('fonts.googleapis')
      expect(text).not.toMatch(/url\(\s*['"]?https?:/)
      expect(text).not.toMatch(/@import/)
    }
    // No bundled app fonts: the file adds only the fonts its deck uses.
    expect(css).not.toContain('@font-face')
    // The same slide styles as the editor (SlideView.module.css).
    expect(css.toLowerCase()).toContain('text-rendering:optimizelegibility')
    expect(css).toContain('isolation:isolate')
    // A classic script, safe to inline (no module syntax, no closing script tag).
    expect(js).not.toMatch(/^\s*import\s/m)
    expect(js).not.toContain('</script')
  }, 120_000)
})
