import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIcon, createImage, createLogo, createShape, createSlide, createText } from '../model/factory'
import type { Theme } from '../model/theme'
import { AssetLoaderContext } from '../storage/assets'
import { OPENDECK_THEME } from '../model/theme'
import type { GroupEl, Paragraph, Slide, SlideElement } from '../model/types'
import { SlideView } from './SlideView'

function slideWith(...elements: SlideElement[]): Slide {
  return { ...createSlide(), elements }
}

function draw(slide: Slide, interactive = true) {
  return render(<SlideView slide={slide} theme={OPENDECK_THEME} scale={0.5} interactive={interactive} />)
}

const node = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-el-id="${id}"]`)!

describe('SlideView', () => {
  it('resolves theme colors through CSS variables set on the root', () => {
    const s = { ...createShape('rect'), fill: { theme: 'accent' as const } }
    const { container } = draw(slideWith(s))
    expect(node(container, s.id).style.backgroundColor).toBe('var(--t-accent)')
    const root = container.querySelector<HTMLElement>('[data-slide-root]')!
    expect(root.style.getPropertyValue('--t-accent')).toBe('#6C4CF5')
    expect(root.style.transform).toBe('scale(0.5)')
  })

  it('keeps a custom color literal', () => {
    const s = { ...createShape('rect'), fill: { hex: '#0F7B6C' } }
    const { container } = draw(slideWith(s))
    expect(node(container, s.id).style.backgroundColor).toBe('rgb(15, 123, 108)')
  })

  it('renders run marks as styled spans', () => {
    const t = createText('body')
    t.paragraphs = [{ align: 'left', list: 'none', runs: [{ text: 'Bold', bold: true, underline: true, color: { hex: '#E2457A' } }] }]
    const { getByText } = draw(slideWith(t))
    const span = getByText('Bold')
    expect(span.tagName).toBe('SPAN')
    expect(span).toHaveStyle({ fontWeight: '700', textDecoration: 'underline', color: '#E2457A' })
  })

  it('renders consecutive bullet paragraphs as one list', () => {
    const t = createText('body')
    const p = (text: string, list: Paragraph['list']): Paragraph => ({ align: 'left', list, runs: [{ text }] })
    t.paragraphs = [p('Intro', 'none'), p('One', 'bullet'), p('Two', 'bullet')]
    const { container } = draw(slideWith(t))
    const items = container.querySelectorAll('ul > li')
    expect(items).toHaveLength(2)
    expect(container.querySelectorAll('ul')).toHaveLength(1)
    expect(container.querySelector('p')!.textContent).toBe('Intro')
  })

  it('renders safe links and never a javascript: link', () => {
    const t = createText('body')
    t.paragraphs = [{
      align: 'left', list: 'none',
      runs: [{ text: 'good', href: 'https://example.com' }, { text: 'bad', href: 'javascript:alert(1)' }],
    }]
    const { container, getByText } = draw(slideWith(t))
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://example.com')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
    expect(getByText('bad').closest('a')).toBeNull()
  })

  it('renders a fallback for an unknown icon name', () => {
    const i = { ...createIcon('star'), name: 'no-such-icon' }
    const { container } = draw(slideWith(i))
    expect(node(container, i.id).querySelector('[data-missing-icon]')).not.toBeNull()
  })

  it('draws elements in array order, last on top', () => {
    const a = createShape('rect'), b = createShape('ellipse'), c = createText('body')
    const { container } = draw(slideWith(a, b, c))
    const ids = [...container.querySelectorAll('[data-el-id]')].map((n) => n.getAttribute('data-el-id'))
    expect(ids).toEqual([a.id, b.id, c.id])
  })

  it('positions group children relative to the group and rotates the group once', () => {
    const child = { ...createShape('rect'), x: 10, y: 20, w: 100, h: 50 }
    const g: GroupEl = { id: 'g1', type: 'group', x: 300, y: 400, w: 200, h: 200, rotation: 30, locked: false, children: [child] }
    const { container } = draw(slideWith(g))
    const gn = node(container, 'g1')
    expect(gn.style.left).toBe('300px')
    expect(gn.style.transform).toBe('rotate(30deg)')
    const cn = node(container, child.id)
    expect(gn.contains(cn)).toBe(true)
    expect(cn.style.left).toBe('10px')
    expect(cn.style.top).toBe('20px')
    expect(cn.style.transform).toBe('')
  })

  it('hides a non-interactive slide from assistive tech and pointer events', () => {
    const { container } = draw(slideWith(createShape('rect')), false)
    const root = container.querySelector<HTMLElement>('[data-slide-root]')!
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.style.pointerEvents).toBe('none')
  })

  it('draws the editing text element with renderTextEditor', () => {
    const t = createText('body')
    const { getByTestId, container } = render(
      <SlideView slide={slideWith(t)} theme={OPENDECK_THEME} scale={1} editingId={t.id}
        renderTextEditor={(el) => <div data-testid="editor">{el.id}</div>} />,
    )
    expect(getByTestId('editor').textContent).toBe(t.id)
    expect(container.textContent).not.toContain('Add some text')
  })

  it('uses the theme corners for a rectangle that follows the theme', () => {
    const r = createShape('rect')
    const { container } = draw(slideWith(r))
    expect(node(container, r.id).style.borderRadius).toBe('27px')
  })
})

describe('logo element', () => {
  beforeEach(() => {
    let n = 0
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:x${n++}`, revokeObjectURL: () => {} }))
  })
  afterEach(() => vi.unstubAllGlobals())

  const loader = async () => new Blob(['x'], { type: 'image/png' })
  const drawLogo = (theme: Theme, slide: Slide, placeholders = false) => render(
    <AssetLoaderContext.Provider value={loader}>
      <SlideView slide={slide} theme={theme} scale={1} placeholders={placeholders} />
    </AssetLoaderContext.Provider>,
  )

  it('draws the theme logo, or a placeholder only when asked', async () => {
    const logo = createLogo()
    const withLogo = drawLogo({ ...OPENDECK_THEME, logo: { main: 'a1' } }, slideWith(logo))
    const el = node(withLogo.container, logo.id)
    expect(el.getAttribute('data-logo-asset')).toBe('a1')
    await waitFor(() => expect(el.querySelector('img')).not.toBeNull())
    withLogo.unmount()

    const hidden = drawLogo(OPENDECK_THEME, slideWith(logo))
    expect(hidden.container.querySelector('[data-logo-placeholder]')).toBeNull()
    expect(node(hidden.container, logo.id).querySelector('img')).toBeNull()
    hidden.unmount()

    const shown = drawLogo(OPENDECK_THEME, slideWith(logo), true)
    expect(shown.container.querySelector('[data-logo-placeholder]')!.textContent).toBe('Logo')
  })

  it('uses the dark logo on a dark slide', () => {
    const logo = createLogo()
    const slide = { ...slideWith(logo), background: { color: { hex: '#0E1320' } } }
    const { container } = drawLogo({ ...OPENDECK_THEME, logo: { main: 'a1', dark: 'a2' } }, slide)
    expect(node(container, logo.id).getAttribute('data-logo-asset')).toBe('a2')
  })
})

describe('template drawing', () => {
  it('draws sample art in theme colors', () => {
    const photo = { ...createImage('', { w: 800, h: 600 }), art: { kind: 'photo' as const, variant: 0 as const } }
    const face = { ...createImage('', { w: 400, h: 400 }), art: { kind: 'initials' as const, text: 'AR', variant: 1 as const } }
    const { container } = draw(slideWith(photo, face))
    expect(node(container, photo.id).querySelector('[data-sample-art="photo"]')).not.toBeNull()
    expect(node(container, photo.id).querySelector('img')).toBeNull()
    expect(node(container, face.id).querySelector('[data-sample-art="initials"]')!.textContent).toBe('AR')
  })

  it('applies opacity, shadow and a fade', () => {
    const sh = { ...createShape('rect'), opacity: 0.5, shadow: true as const, fade: 'up' as const, fill: { theme: 'text' as const } }
    const { container } = draw(slideWith(sh))
    const n = node(container, sh.id)
    expect(n.style.opacity).toBe('0.5')
    expect(n.style.filter).toContain('drop-shadow')
    expect(n.style.backgroundImage).toBe('linear-gradient(to top, var(--t-text), transparent)')
    expect(n.style.backgroundColor).toBe('')
  })

  it('draws nothing for a fade with no fill', () => {
    const sh = { ...createShape('rect'), fade: 'left' as const, fill: null }
    const { container } = draw(slideWith(sh))
    expect(node(container, sh.id).style.backgroundImage).toBe('')
  })

  it('shows no placeholder for a template logo on a theme without one', () => {
    const fromTemplate = { ...createLogo(), role: 'decor' }
    const own = createLogo()
    const { container } = render(<SlideView slide={slideWith(fromTemplate, own)} theme={OPENDECK_THEME} scale={1} placeholders />)
    expect(node(container, fromTemplate.id).querySelector('[data-logo-placeholder]')).toBeNull()
    expect(node(container, own.id).querySelector('[data-logo-placeholder]')).not.toBeNull()
  })

  it('never draws parked elements on the slide', () => {
    const kept = createText('body')
    const parked = { ...createText('body'), aside: true as const }
    const slide = slideWith(kept, parked)
    const normal = draw(slide)
    expect(node(normal.container, parked.id)).toBeNull()
    expect(node(normal.container, kept.id)).not.toBeNull()
    normal.unmount()
    const only = render(<SlideView slide={slide} theme={OPENDECK_THEME} scale={1} aside="only" />)
    expect(node(only.container, parked.id)).not.toBeNull()
    expect(node(only.container, kept.id)).toBeNull()
  })
})
