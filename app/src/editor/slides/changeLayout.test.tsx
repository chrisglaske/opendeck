import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createDeck } from '../../model/factory'
import { plainText } from '../../model/richtext'
import type { Deck, Slide, TextEl } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { builtinTemplate } from '../../templates/builtins'
import { slideFromTemplate } from '../../templates/instantiate'
import { ToastHost } from '../../ui'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import { changeLayout } from './changeLayout'
import { setLayoutPreview } from './layoutPreview'

afterEach(() => {
  setLayoutPreview(null)
  localStorage.clear()
})

/** A KPI grid slide; `texts` types over the elements with those roles. */
function kpiSlide(texts: Record<string, string> = {}): Slide {
  const s = slideFromTemplate(builtinTemplate('kpis')!)
  s.elements = s.elements.map((e) => {
    if (e.type !== 'text' || !e.role || !(e.role in texts)) return e
    const { sample: _s, ...rest } = e
    return { ...rest, paragraphs: [{ ...e.paragraphs[0], runs: [{ text: texts[e.role] }] }] }
  })
  return s
}

function setup(edit: (d: Deck) => void) {
  const deck = createDeck('Q3 Board update')
  edit(deck)
  const store = createEditorStore(deck)
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={createAutosaver(createMemoryStore())} />
      <ToastHost />
    </EditorProvider>,
  )
  return { store, deck }
}

const canvas = () => screen.getByRole('main', { name: 'Slide canvas' })
const panel = () => screen.getByRole('complementary', { name: 'Change layout' })
const openChange = (name: RegExp) => userEvent.click(screen.getByRole('button', { name }))

describe('Change layout', () => {
  it('shows the slide\'s layout and "No layout" for a blank slide', async () => {
    const { store, deck } = setup((d) => {
      d.slides = [d.slides[0], kpiSlide()]
    })
    expect(screen.getByRole('button', { name: /No layout/ })).toBeInTheDocument()
    act(() => store.select({ slideId: deck.slides[1].id, ids: [] }))
    const field = screen.getByRole('button', { name: /KPI grid/ })
    expect(field).toHaveTextContent('Numbers')
    await userEvent.click(field)
    expect(panel()).toBeInTheDocument()
    expect(within(panel()).getByText('Your text and pictures move to the new layout.')).toBeInTheDocument()
    expect(within(panel()).queryByRole('button', { name: 'Blank' })).toBeNull()
    expect(within(panel()).getByRole('button', { name: 'KPI grid' })).toHaveAttribute('aria-current', 'true')
  })

  it('previews on hover without changing the deck', async () => {
    const { store } = setup((d) => {
      d.slides = [kpiSlide()]
    })
    const before = store.getState().deck
    await openChange(/KPI grid/)
    expect(within(canvas()).getByText('Q3 at a glance')).toBeInTheDocument()
    await userEvent.hover(within(panel()).getByRole('button', { name: 'Three numbers' }))
    expect(within(canvas()).getByText('Revenue grew 32%')).toBeInTheDocument()
    expect(within(canvas()).getByText(/click to switch/)).toBeInTheDocument()
    expect(store.getState().deck).toBe(before)
    await userEvent.unhover(within(panel()).getByRole('button', { name: 'Three numbers' }))
    expect(within(canvas()).queryByText('Revenue grew 32%')).toBeNull()
    expect(within(canvas()).getByText('Q3 at a glance')).toBeInTheDocument()
  })

  it('switches on click as one undo step with a toast', async () => {
    const typed = kpiSlide({ 'stat.value[1]': '$2M', 'stat.value[2]': '120%', 'stat.value[3]': '1.8%', 'stat.value[4]': '71' })
    const { store } = setup((d) => {
      d.slides = [typed]
    })
    await openChange(/KPI grid/)
    await userEvent.click(within(panel()).getByRole('button', { name: 'Three numbers' }))
    const now = store.getState().deck.slides[0]
    expect(now.layout).toBe('builtin:stats')
    expect(screen.getByText('Switched to Three numbers · 1 item kept beside the slide')).toBeInTheDocument()
    expect(within(canvas()).getByText('Not in this layout')).toBeInTheDocument()
    act(() => store.undo())
    expect(store.getState().deck.slides[0]).toEqual(typed)
  })

  it('takes back only the switch from the toast after a later edit', async () => {
    const typed = kpiSlide({ title: 'Mine' })
    const { store } = setup((d) => {
      d.slides = [typed]
    })
    await openChange(/KPI grid/)
    await userEvent.click(within(panel()).getByRole('button', { name: 'Section' }))
    act(() => store.apply((d) => ({ ...d, name: 'Renamed' })))
    const t = screen.getByText('Switched to Section').parentElement!
    await userEvent.click(within(t).getByRole('button', { name: 'Undo' }))
    expect(store.getState().deck.name).toBe('Renamed')
    expect(store.getState().deck.slides[0]).toEqual(typed)
  })

  it('commits text being edited before switching', () => {
    const s = kpiSlide({ title: '' })
    const title = s.elements.find((e) => e.role === 'title') as TextEl
    const { store } = setup((d) => {
      d.slides = [s]
    })
    act(() => {
      store.select({ slideId: s.id, ids: [title.id] })
      store.setEditing(title.id)
    })
    const editor = document.querySelector<HTMLElement>('[data-text-editor]')!
    for (const ch of 'Q4 at a glance') {
      act(() => {
        editor.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true }))
      })
    }
    act(() => changeLayout(store, builtinTemplate('stats')!))
    const out = store.getState().deck.slides[0]
    expect(out.layout).toBe('builtin:stats')
    expect(plainText((out.elements.find((e) => e.role === 'title') as TextEl).paragraphs)).toBe('Q4 at a glance')
    expect(store.getState().editingId).toBeNull()
  })
})
