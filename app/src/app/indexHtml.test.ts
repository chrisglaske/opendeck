import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'

/* The page head as shipped: what search engines and link previews read. */
const doc = new DOMParser().parseFromString(html, 'text/html')
const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content')

describe('index.html', () => {
  it('has a title, description and canonical address', () => {
    expect(doc.title).toBe('OpenDeck – Good-looking decks, without the fuss')
    expect(meta('meta[name=description]')).toBe('Pick a template, type over it, and try a different look in one click. Your decks stay on your computer.')
    expect(doc.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe('https://opendeck.work/')
    expect(doc.querySelector('meta[name=theme-color]')).not.toBeNull()
  })

  it('has link preview tags with a 1200×630 image', () => {
    expect(meta('meta[property="og:title"]')).toBe('OpenDeck – Good-looking decks, without the fuss')
    expect(meta('meta[property="og:description"]')).toBeTruthy()
    expect(meta('meta[property="og:url"]')).toBe('https://opendeck.work/')
    expect(meta('meta[property="og:image"]')).toBe('https://opendeck.work/og-image.png')
    expect(meta('meta[property="og:image:width"]')).toBe('1200')
    expect(meta('meta[property="og:image:height"]')).toBe('630')
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image')
  })

  it('serves from the site root', () => {
    expect(html).not.toContain('/v2/')
    expect(doc.querySelector('link[rel=icon]')?.getAttribute('href')).toBe('/favicon.svg')
  })
})
