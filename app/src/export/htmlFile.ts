import type { Deck } from '../model/types'
import type { AssetLoader } from '../storage/assets'
import { deckAssetIds } from '../storage/deckFile'
import { bytesOf, toBase64 } from '../storage/fileData'

/** A font face carried inside the file. `family` is the name slides ask for. */
export type FileFontFace = { family: string; weight?: string; style?: string; unicodeRange?: string; data: ArrayBuffer; type: string }

export type HtmlFileDeps = {
  loadAsset: AssetLoader
  fontFaces: readonly FileFontFace[]
  /** The built player: one classic script and one stylesheet. */
  player: { js: string; css: string }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Font descriptors come from our own stylesheets or stored fonts; keep them to what CSS allows here.
const cssString = (s: string) => `'${s.replace(/[\\'\n\r<>]/g, '')}'`
const descriptor = (s: string | undefined, ok: RegExp) => (s && ok.test(s) ? s : undefined)

function fontFaceCss(f: FileFontFace): string {
  const parts = [`font-family:${cssString(f.family)}`, `src:url(data:${f.type.replace(/[^a-z0-9/+.-]/gi, '')};base64,${toBase64(new Uint8Array(f.data))})`]
  const weight = descriptor(f.weight, /^[0-9 ]+$|^(normal|bold)$/)
  const style = descriptor(f.style, /^(normal|italic|oblique)$/)
  const range = descriptor(f.unicodeRange, /^[uU0-9a-fA-F+?, -]+$/)
  if (weight) parts.push(`font-weight:${weight}`)
  if (style) parts.push(`font-style:${style}`)
  if (range) parts.push(`unicode-range:${range}`)
  parts.push('font-display:block')
  return `@font-face{${parts.join(';')}}`
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return `sha256-${toBase64(new Uint8Array(digest))}`
}

/**
 * One self-contained HTML file that presents the deck: the player, the deck (without hidden
 * slides), every picture once and the fonts it uses, under a policy that allows nothing else.
 */
export async function buildHtmlFile(deck: Deck, deps: HtmlFileDeps): Promise<Blob> {
  const shown: Deck = { ...deck, slides: deck.slides.filter((s) => !s.hidden) }
  const assets: Record<string, { type: string; base64: string }> = {}
  for (const id of deckAssetIds(shown)) {
    const blob = await deps.loadAsset(id)
    if (blob) assets[id] = { type: blob.type, base64: toBase64(await bytesOf(blob)) }
  }
  // JSON in a script element: no "<" at all, so nothing can close it or open a comment.
  const json = JSON.stringify({ deck: shown, assets }).replace(/</g, '\\u003c')
  const css = deps.fontFaces.map(fontFaceCss).join('') + deps.player.css
  const js = deps.player.js
  const policy = [
    "default-src 'none'",
    `script-src '${await sha256(js)}'`,
    `style-src '${await sha256(css)}'`,
    'img-src data: blob:',
    'font-src data:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  const html =
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    `<meta http-equiv="Content-Security-Policy" content="${policy}">\n` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    `<title>${escapeHtml(deck.name)}</title>\n` +
    `<style>${css}</style>\n</head>\n<body>\n<div id="root"></div>\n` +
    `<script type="application/json" id="opendeck-data">${json}</script>\n` +
    `<script>${js}</script>\n</body>\n</html>\n`
  return new Blob([html], { type: 'text/html' })
}

/** "340 KB", "2.1 MB", "52 MB". */
export function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 10) return `${Math.round(mb)} MB`
  if (mb >= 1) return `${Math.round(mb * 10) / 10} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
