import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createImage, createSlide, createText } from '../model/factory'
import { LIMITS } from '../model/sanitize'
import type { ImageEl, TextEl } from '../model/types'
import { templateFromSlide } from '../templates/fromSlide'
import { TEMPLATE_FORMAT, TEMPLATE_VERSION } from '../templates/templateData'
import type { Template } from '../templates/types'
import { createMemoryStore, keepUnsaved } from './deckStore'
import { exportTemplateFile, importTemplateFile, TEMPLATE_MAX_BYTES } from './templateFile'
import { myTemplate, resetMyTemplates, saveTemplate } from './templates'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

class FakeCanvas {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  getContext() { return { drawImage() {} } }
  async convertToBlob(o: { type: string }) { return new Blob([new Uint8Array(10_000)], { type: o.type }) }
}
beforeEach(() => {
  vi.stubGlobal('createImageBitmap', async () => ({ width: 40, height: 20, close() {} }))
  vi.stubGlobal('OffscreenCanvas', FakeCanvas)
})
afterEach(() => {
  vi.unstubAllGlobals()
  resetMyTemplates()
})

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const file = (data: unknown, name = 'story.odtemplate') => new File([JSON.stringify(data)], name, { type: 'application/json' })

function storyTemplate(): Template {
  const s = createSlide()
  s.elements = [{ ...createText('title'), role: 'title' }, createImage('a1', { w: 40, h: 20 })]
  s.background = { color: { theme: 'bg' }, imageId: 'bg1' }
  return { ...templateFromSlide(s, 'Customer story'), id: 't1' }
}
async function sourceStore() {
  const s = createMemoryStore()
  for (const id of ['a1', 'bg1']) await s.putAsset({ id, blob: new Blob([PNG], { type: 'image/png' }), type: 'image/png', width: 40, height: 20 })
  return s
}
const images = (t: Template) => t.slide.elements.filter((e): e is ImageEl => e.type === 'image')

describe('template files', () => {
  it('round-trips a template with its pictures', async () => {
    const blob = await exportTemplateFile(await sourceStore(), storyTemplate())
    const parsed = JSON.parse(await blob.text())
    expect(parsed.format).toBe(TEMPLATE_FORMAT)
    expect(parsed.version).toBe(TEMPLATE_VERSION)
    expect(parsed.assets.map((a: { id: string }) => a.id).sort()).toEqual(['a1', 'bg1'])

    const other = createMemoryStore()
    const r = await importTemplateFile(other, new File([blob], 'story.odtemplate'))
    if (!r.ok) throw new Error(r.reason)
    expect(r.template.id).not.toBe('t1')
    expect(r.template.name).toBe('Customer story')
    expect(r.template.group).toBe('mine')
    const img = images(r.template)[0]
    expect(img.assetId).not.toBe('a1')
    expect(img.art).toBeUndefined()
    const stored = await other.getAsset(img.assetId)
    expect(stored).toMatchObject({ width: 40, height: 20 })
    expect(r.template.slide.background.imageId).toBeDefined()
    expect(r.template.slide.background.imageId).not.toBe('bg1')
    expect(myTemplate(r.template.id)?.name).toBe('Customer story')
    expect(await other.listTemplates()).toHaveLength(1)
  })

  it('never replaces a stored template or picture', async () => {
    const store = await sourceStore()
    const original = storyTemplate()
    await saveTemplate(store, original)
    const before = await store.getAsset('a1')
    const blob = await exportTemplateFile(store, { ...original, name: 'Imposter' })
    const r = await importTemplateFile(store, new File([blob], 'x.odtemplate'))
    if (!r.ok) throw new Error(r.reason)
    expect(r.template.id).not.toBe(original.id)
    expect(myTemplate(original.id)?.name).toBe('Customer story')
    expect(images(r.template)[0].assetId).not.toBe('a1')
    expect(await store.getAsset('a1')).toEqual(before)
  })

  it('refuses SVG renamed as PNG and turns it into a sample picture', async () => {
    const t = storyTemplate()
    const r = await importTemplateFile(createMemoryStore(), file({
      format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, template: t,
      assets: [{ id: 'a1', type: 'image/png', width: 40, height: 20, data: b64(SVG) }],
    }))
    if (!r.ok) throw new Error(r.reason)
    const img = images(r.template)[0]
    expect(img.assetId).toBe('')
    expect(img.art).toEqual({ kind: 'photo', variant: 0 })
    expect(img.sample).toBe(true)
    // The background picture had no bytes in the file, so it is dropped.
    expect(r.template.slide.background.imageId).toBeUndefined()
  })

  it('refuses files over 30 MB without reading them', async () => {
    const f = new File(['{}'], 'big.odtemplate')
    Object.defineProperty(f, 'size', { value: TEMPLATE_MAX_BYTES + 1 })
    const text = vi.spyOn(f, 'text')
    expect(await importTemplateFile(createMemoryStore(), f)).toEqual({ ok: false, reason: 'too-large' })
    expect(text).not.toHaveBeenCalled()
  })

  it('cleans unknown roles, bad links and too many elements', async () => {
    const t = storyTemplate()
    const evil: TextEl = { ...createText('body'), role: 'evil' }
    evil.paragraphs = [{ runs: [{ text: 'click', href: 'javascript:alert(1)' }], align: 'left', list: 'none' }]
    const many = Array.from({ length: 10_000 }, () => createText('caption'))
    const r = await importTemplateFile(createMemoryStore(), file({
      format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, template: { ...t, slide: { ...t.slide, elements: [evil, ...many] } }, assets: [],
    }))
    if (!r.ok) throw new Error(r.reason)
    const first = r.template.slide.elements[0] as TextEl
    expect(first.role).toBeUndefined()
    expect(first.paragraphs[0].runs[0].href).toBeUndefined()
    expect(r.template.slide.elements.length).toBeLessThanOrEqual(LIMITS.elements)
  })

  it('reports not-a-template and newer-version', async () => {
    const store = createMemoryStore()
    expect(await importTemplateFile(store, new File(['not json'], 'x.odtemplate'))).toEqual({ ok: false, reason: 'not-a-template' })
    expect(await importTemplateFile(store, file({ format: 'opendeck-theme', version: 1 }))).toEqual({ ok: false, reason: 'not-a-template' })
    expect(await importTemplateFile(store, file({ format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION + 1, template: {} }))).toEqual({ ok: false, reason: 'newer-version' })
  })

  it('keeps an imported template in this tab when storage refuses it', async () => {
    const store = await sourceStore()
    const blob = await exportTemplateFile(store, storyTemplate())
    store.putTemplate = () => Promise.reject(new DOMException('full', 'QuotaExceededError'))
    const r = await importTemplateFile(store, new File([blob], 'x.odtemplate'))
    expect(r.ok && r.notSaved).toBe('quota')
  })

  it('says so when a picture could not be saved, even if the template was', async () => {
    const blob = await exportTemplateFile(await sourceStore(), storyTemplate())
    const base = createMemoryStore()
    const store = keepUnsaved({ ...base, putAsset: () => Promise.reject(new DOMException('full', 'QuotaExceededError')) })
    const r = await importTemplateFile(store, new File([blob], 'x.odtemplate'))
    if (!r.ok) throw new Error(r.reason)
    expect(images(r.template)[0].assetId).not.toBe('')
    expect(r.notSaved).toBe('quota')
  })
})
