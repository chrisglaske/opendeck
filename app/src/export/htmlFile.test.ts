import { describe, expect, it } from 'vitest'
import { createDeck, createImage, createSlide } from '../model/factory'
import type { Deck } from '../model/types'
import { buildHtmlFile, formatSize } from './htmlFile'

const player = { js: 'window.__played = 1', css: 'body{margin:0}' }

function deck(name = 'Q3 Board update'): Deck {
  const d = createDeck(name)
  const pic = (assetId: string) => ({ ...createSlide(), elements: [createImage(assetId, { w: 10, h: 10 })] })
  const hidden = { ...pic('secret'), id: 'hidden-slide', hidden: true as const }
  d.slides = [pic('p1'), hidden, pic('p1')]
  return d
}

const loads: string[] = []
const loadAsset = async (id: string) => {
  loads.push(id)
  return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
}
const font = { family: 'Manrope Variable', weight: '200 800', style: 'normal', unicodeRange: 'U+0000-00FF', data: new Uint8Array([7, 7, 7]).buffer, type: 'font/woff2' }

async function html(d: Deck, deps: Partial<Parameters<typeof buildHtmlFile>[1]> = {}) {
  loads.length = 0
  const blob = await buildHtmlFile(d, { loadAsset, fontFaces: [font], player, ...deps })
  return blob.text()
}

const dataOf = (text: string) => {
  const m = text.match(/<script type="application\/json" id="opendeck-data">([\s\S]*?)<\/script>/)
  return JSON.parse(m![1]) as { deck: Deck; assets: Record<string, { type: string; base64: string }> }
}
const sha = async (s: string) => {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return `sha256-${btoa(String.fromCharCode(...d))}`
}

describe('buildHtmlFile', () => {
  it('leaves out hidden slides and carries each picture once', async () => {
    const text = await html(deck())
    const data = dataOf(text)
    expect(data.deck.slides).toHaveLength(2)
    expect(data.deck.slides.some((s) => s.id === 'hidden-slide')).toBe(false)
    expect(Object.keys(data.assets)).toEqual(['p1'])
    expect(data.assets.p1).toEqual({ type: 'image/png', base64: 'AQID' })
    expect(loads).toEqual(['p1'])
  })

  it('escapes the deck name and never closes the data script early', async () => {
    const name = '</script><img src=x onerror=alert(1)>'
    const text = await html(deck(name))
    expect(text).toContain('<title>&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;</title>')
    expect(text).not.toContain('<img src=x')
    const json = text.match(/id="opendeck-data">([\s\S]*?)<\/script>/)![1]
    expect(json).not.toContain('<')
    expect(dataOf(text).deck.name).toBe(name)
  })

  it('has a strict policy whose hashes match its own script and style', async () => {
    const text = await html(deck())
    const csp = text.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)![1]
    const script = text.match(/<script>([\s\S]*?)<\/script>/)![1]
    const style = text.match(/<style>([\s\S]*?)<\/style>/)![1]
    expect(script).toBe(player.js)
    expect(style).toContain(player.css)
    expect(style).toContain("font-family:'Manrope Variable'")
    expect(style).toContain('src:url(data:font/woff2;base64,BwcH)')
    expect(style).toContain('unicode-range:U+0000-00FF')
    expect(csp).toContain(`script-src '${await sha(script)}'`)
    expect(csp).toContain(`style-src '${await sha(style)}'`)
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain('img-src data: blob:')
    expect(csp).toContain('font-src data:')
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("form-action 'none'")
    // The policy comes before anything it governs.
    expect(text.indexOf('Content-Security-Policy')).toBeLessThan(text.indexOf('<style>'))
  })

  it('points at nothing outside the file', async () => {
    const text = await html(deck())
    expect(text).not.toMatch(/https?:\/\//)
  })

  it('still builds when a picture is missing', async () => {
    const text = await html(deck(), { loadAsset: async () => null })
    expect(dataOf(text).assets).toEqual({})
    expect(dataOf(text).deck.slides).toHaveLength(2)
  })
})

describe('formatSize', () => {
  it('reads like a file size', () => {
    expect(formatSize(900)).toBe('1 KB')
    expect(formatSize(340 * 1024)).toBe('340 KB')
    expect(formatSize(2.1 * 1024 * 1024)).toBe('2.1 MB')
    expect(formatSize(52 * 1024 * 1024)).toBe('52 MB')
  })
})
