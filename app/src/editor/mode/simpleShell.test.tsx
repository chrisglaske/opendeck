import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createSlide, createText } from '../../model/factory'
import type { Slide } from '../../model/types'
import { BUILTIN_TEMPLATES } from '../../templates/builtins'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import { setEditorMode } from './editorMode'

function setup(patch: Partial<Slide> = {}) {
  const deck = createDeck('Q3 Board update')
  const text = createText('body')
  const slide: Slide = { ...createSlide(), elements: [text], ...patch }
  deck.slides = [slide]
  const store = createEditorStore(deck)
  const autosaver = createAutosaver(createMemoryStore())
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={autosaver} />
    </EditorProvider>,
  )
  const current = () => store.getState().deck.slides[0]
  return { store, text, slide, current }
}

const dockNames = () => within(screen.getByRole('toolbar', { name: 'Insert' })).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)

beforeEach(() => setEditorMode('simple'))
afterEach(() => vi.restoreAllMocks())

describe('Simple dock', () => {
  it('shows Text, Picture, Shape and Layouts only, with visible names', () => {
    setup()
    expect(dockNames()).toEqual(['Text', 'Picture', 'Shape', 'Layouts'])
    const dock = screen.getByRole('toolbar', { name: 'Insert' })
    for (const name of ['Text', 'Picture', 'Shape', 'Layouts']) expect(within(dock).getByText(name)).toBeVisible()
  })

  it('Picture opens the file picker', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Picture' }))
    expect(click).toHaveBeenCalled()
  })

  it('Shape adds a rectangle', async () => {
    const { current } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Shape' }))
    expect(current().elements.at(-1)).toMatchObject({ type: 'shape', shape: 'rect' })
  })
})

describe('Simple slide panel', () => {
  it('stays on Slide when something is selected', () => {
    const { store, slide, text } = setup()
    act(() => store.select({ slideId: slide.id, ids: [text.id] }))
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Slide'])
    expect(screen.getByRole('complementary', { name: 'Slide settings' })).toBeInTheDocument()
  })

  it('shows the layout card and Change layout opens the change-layout panel', async () => {
    const t = BUILTIN_TEMPLATES[0]
    setup({ layout: `builtin:${t.id}` })
    expect(screen.getByText(t.name)).toBeInTheDocument()
    expect(screen.getByText('Your text moves with you')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Change layout' }))
    expect(screen.getByRole('complementary', { name: 'Change layout' })).toBeInTheDocument()
  })

  it('offers the four theme backgrounds only', () => {
    setup()
    expect(within(screen.getByRole('radiogroup', { name: 'Background' })).getAllByRole('radio')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /Custom background color/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add image' })).not.toBeInTheDocument()
    expect(screen.queryByText('Background image')).not.toBeInTheDocument()
  })

  it('a custom background shows no checked swatch and a pick replaces it in one undo step', async () => {
    const { store, current } = setup({ background: { color: { hex: '#2F9E6B' } } })
    const radios = within(screen.getByRole('radiogroup', { name: 'Background' })).getAllByRole('radio')
    for (const r of radios) expect(r).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(screen.getByRole('radio', { name: 'Surface' }))
    expect(current().background.color).toEqual({ theme: 'surface' })
    act(() => store.undo())
    expect(current().background.color).toEqual({ hex: '#2F9E6B' })
  })

  it('a background image stays when a swatch is picked', async () => {
    const { current } = setup({ background: { color: { theme: 'bg' }, imageId: 'img-1' } })
    await userEvent.click(screen.getByRole('radio', { name: 'Surface' }))
    expect(current().background).toEqual({ color: { theme: 'surface' }, imageId: 'img-1' })
  })

  it('keeps speaker notes and hide slide', () => {
    setup()
    expect(screen.getByLabelText('Speaker notes')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Hide this slide' })).toBeInTheDocument()
  })
})

describe('Advanced is unchanged', () => {
  it('has the full dock and Style/Arrange tabs for a selection', () => {
    const { store, slide, text } = setup()
    act(() => setEditorMode('advanced'))
    expect(dockNames()).toEqual(['Text', 'Shape', 'Line', 'Image', 'Icon', 'Logo', 'Layouts'])
    act(() => store.select({ slideId: slide.id, ids: [text.id] }))
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Style', 'Arrange'])
  })
})
