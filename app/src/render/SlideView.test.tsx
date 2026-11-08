import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createIcon, createShape, createSlide, createText } from '../model/factory'
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
})
