import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDeck, createIcon, createImage, createLine, createLogo, createShape, createSlide, createText } from '../../model/factory'
import { group } from '../../model/ops'
import type { SlideElement, TextEl } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import { setEditorMode } from './editorMode'

function setup(elements: SlideElement[]) {
  const deck = createDeck('Q3 Board update')
  deck.slides = [{ ...createSlide(), elements }]
  const store = createEditorStore(deck)
  const autosaver = createAutosaver(createMemoryStore())
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={autosaver} />
    </EditorProvider>,
  )
  const slideId = deck.slides[0].id
  const select = (...ids: string[]) => act(() => store.select({ slideId, ids }))
  const el = (id: string) => store.getState().deck.slides[0].elements.find((e) => e.id === id)
  return { store, slideId, select, el }
}

/** Accessible names of the controls in the quick bar. */
const barNames = (label: string) =>
  [...screen.getByRole('toolbar', { name: label }).querySelectorAll('button, input')].map(
    (b) => b.getAttribute('aria-label') ?? b.textContent ?? '',
  )

const has = (names: string[], re: RegExp) => names.some((n) => re.test(n))

beforeEach(() => setEditorMode('simple'))

describe('Simple text bar', () => {
  it('has text style, size, bold, italic, color, alignment and bullets only', () => {
    const t = createText('heading')
    const { select } = setup([t])
    select(t.id)
    const names = barNames('Text options')
    for (const re of [/^Text style/, /^Font size$/, /^Common sizes$/, /^Bold$/, /^Italic$/, /^Text color/, /^Align /, /^Bullet list$/]) {
      expect(has(names, re), String(re)).toBe(true)
    }
    for (const re of [/^Font:/, /^Underline$/, /^Link$/, /^More actions$/]) expect(has(names, re), String(re)).toBe(false)
    expect(screen.getByRole('button', { name: /^Text style/ })).toHaveTextContent('Heading')
  })

  it('the text style menu applies Title and clears hand-set size and font', async () => {
    const t: TextEl = { ...createText('body'), size: 50, font: 'heading' }
    const { select, el } = setup([t])
    select(t.id)
    await userEvent.click(screen.getByRole('button', { name: /^Text style/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Title' }))
    const next = el(t.id) as TextEl
    expect(next.style).toBe('title')
    expect(next.size).toBeUndefined()
    expect(next.font).toBeUndefined()
  })

  it('text color offers theme colors only', async () => {
    const t = createText('body')
    const { select } = setup([t])
    select(t.id)
    await userEvent.click(screen.getByRole('button', { name: /^Text color/ }))
    const pop = screen.getByRole('dialog', { name: 'Text color' })
    expect(within(pop).getByText('Theme colors')).toBeInTheDocument()
    expect(within(pop).getByRole('button', { name: 'Accent' })).toBeInTheDocument()
    expect(within(pop).queryByRole('button', { name: 'Mix a custom color' })).not.toBeInTheDocument()
    expect(within(pop).queryByText(/^Custom/)).not.toBeInTheDocument()
  })

  it('a custom text color is named and a theme pick replaces it', async () => {
    const base = createText('body')
    const t: TextEl = { ...base, color: { hex: '#2F9E6B' } }
    const { select, el } = setup([t])
    select(t.id)
    await userEvent.click(screen.getByRole('button', { name: /^Text color/ }))
    const pop = screen.getByRole('dialog', { name: 'Text color' })
    expect(within(pop).getByText('This text has a custom color')).toBeInTheDocument()
    for (const b of within(pop).getAllByRole('button')) expect(b).not.toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(pop).getByRole('button', { name: 'Accent' }))
    expect((el(t.id) as TextEl).color).toEqual({ theme: 'accent' })
  })
})

describe('Simple bars for other elements', () => {
  it('picture: Replace, fill/fit, Crop, Delete', async () => {
    const img = createImage('a1', { w: 800, h: 600 })
    const { select, el } = setup([img])
    select(img.id)
    const names = barNames('Image options')
    for (const re of [/^Replace$/, /^Fill$/, /^Fit$/, /^Crop$/, /^Delete$/]) expect(has(names, re), String(re)).toBe(true)
    expect(has(names, /^Duplicate$|^More actions$/)).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(el(img.id)).toBeUndefined()
  })

  it('shape: fill and Delete only, with a custom fill named', async () => {
    const sh = { ...createShape('rect'), fill: { hex: '#2F9E6B' } }
    const { select } = setup([sh])
    select(sh.id)
    const names = barNames('Shape options')
    expect(has(names, /^Fill color/)).toBe(true)
    expect(has(names, /^Delete$/)).toBe(true)
    for (const re of [/^Border color/, /^Border width$/, /^Corner radius$/, /^Duplicate$/]) expect(has(names, re), String(re)).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: /^Fill color/ }))
    const pop = screen.getByRole('dialog', { name: 'Fill color' })
    expect(within(pop).getByText('This shape has a custom color')).toBeInTheDocument()
    expect(within(pop).queryByRole('button', { name: 'No fill' })).not.toBeInTheDocument()
  })

  it('icon: color and Delete only', () => {
    const ic = createIcon('star')
    const { select } = setup([ic])
    select(ic.id)
    const names = barNames('Icon options')
    expect(has(names, /^Icon color/)).toBe(true)
    expect(has(names, /^Delete$/)).toBe(true)
    expect(has(names, /^Replace icon$|^Line weight$/)).toBe(false)
  })

  it('line: color and Delete only', () => {
    const ln = createLine()
    const { select } = setup([ln])
    select(ln.id)
    const names = barNames('Line options')
    expect(has(names, /^Line color/)).toBe(true)
    expect(has(names, /^Delete$/)).toBe(true)
    expect(has(names, /^Line width$|^Arrow at|line, switch to/)).toBe(false)
  })

  it('logo: Delete only', () => {
    const lg = createLogo()
    const { select } = setup([lg])
    select(lg.id)
    expect(barNames('Logo options')).toEqual(['Delete'])
  })

  it('several items: count, Duplicate and Delete', () => {
    const a = createShape('rect'), b = createShape('rect')
    const { select } = setup([a, b])
    select(a.id, b.id)
    expect(screen.getByRole('toolbar', { name: 'Selection options' })).toHaveTextContent('2 selected')
    expect(barNames('Selection options')).toEqual(['Duplicate', 'Delete'])
  })

  it('a group: Duplicate and Delete', () => {
    const a = createShape('rect'), b = createShape('rect')
    const { store, slideId, select } = setup([a, b])
    let gid = ''
    act(() => {
      const r = group(store.getState().deck, slideId, [a.id, b.id])
      gid = r.groupId
      store.apply(() => r.deck)
    })
    select(gid)
    expect(barNames('Group options')).toEqual(['Duplicate', 'Delete'])
  })
})

describe('switching modes', () => {
  it('switching to Simple closes an open font list and color mixer', async () => {
    const t = createText('body')
    setEditorMode('advanced')
    const { select } = setup([t])
    select(t.id)
    await userEvent.click(screen.getByRole('button', { name: /^Font:/ }))
    expect(screen.getByRole('dialog', { name: 'Font' })).toBeInTheDocument()
    act(() => setEditorMode('simple'))
    expect(screen.queryByRole('dialog', { name: 'Font' })).not.toBeInTheDocument()
    act(() => setEditorMode('advanced'))
    await userEvent.click(screen.getByRole('button', { name: /^Text color/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Mix a custom color' }))
    act(() => setEditorMode('simple'))
    expect(screen.queryByRole('button', { name: 'Mix a custom color' })).not.toBeInTheDocument()
  })

  it('Advanced bars are unchanged', () => {
    const t = createText('body')
    setEditorMode('advanced')
    const { select } = setup([t])
    select(t.id)
    const names = barNames('Text options')
    for (const re of [/^Font:/, /^Underline$/, /^Link$/, /^More actions$/]) expect(has(names, re), String(re)).toBe(true)
  })
})
