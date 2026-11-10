import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { BrandKit } from '../../model/brandKit'
import { builtinTheme } from '../../model/builtinThemes'
import { createDeck, createShape, createText } from '../../model/factory'
import { OPENDECK_THEME } from '../../model/theme'
import { themeFromKit } from '../../model/themeOps'
import type { Deck, TextEl } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { loadKits, resetBrandKits } from '../../storage/kits'
import { ToastHost } from '../../ui'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import { setPreviewTheme } from './themePreview'

afterEach(() => {
  resetBrandKits()
  setPreviewTheme(null)
  localStorage.clear()
})

function setup(edit?: (d: Deck) => void) {
  const deck = createDeck('Q3 Board update')
  const text: TextEl = { ...createText('body'), x: 100, y: 100, paragraphs: [{ runs: [{ text: '' }], align: 'left', list: 'none' }] }
  const shape = createShape('rect')
  deck.slides[0].elements = [text, shape]
  edit?.(deck)
  const store = createEditorStore(deck)
  const autosaver = createAutosaver(createMemoryStore())
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={autosaver} />
      <ToastHost />
    </EditorProvider>,
  )
  return { store, deck, text, shape }
}

const themeButton = () => screen.getByRole('button', { name: 'Theme' })
const panel = () => screen.getByRole('complementary', { name: 'Theme' })
const stageRoot = () => screen.getByRole('main', { name: 'Slide canvas' }).querySelector<HTMLElement>('[data-slide-root]')!
const stageBg = () => stageRoot().style.getPropertyValue('--t-bg')
const card = (name: string) => within(panel()).getByRole('button', { name })
const pill = () => screen.queryByText((_, el) => el?.getAttribute('data-preview-pill') !== null && el?.tagName === 'DIV')

describe('theme panel', () => {
  it('opens from the top bar and closes when an element is selected', async () => {
    const { store, deck, shape } = setup()
    await userEvent.click(themeButton())
    expect(panel()).toBeInTheDocument()
    expect(themeButton()).toHaveAttribute('aria-pressed', 'true')
    act(() => store.select({ slideId: deck.slides[0].id, ids: [shape.id] }))
    expect(screen.queryByRole('complementary', { name: 'Theme' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Style' })).toBeInTheDocument()
    expect(themeButton()).toHaveAttribute('aria-pressed', 'false')
  })

  it('previews on hover without changing the deck', async () => {
    const { store } = setup()
    await userEvent.click(themeButton())
    fireEvent.pointerEnter(card('Midnight'))
    expect(stageBg()).toBe('#0E1320')
    expect(pill()).toHaveTextContent('Previewing Midnight · click to apply')
    expect(store.getState().deck.theme.id).toBe('opendeck')
    expect(store.getState().canUndo).toBe(false)
    fireEvent.pointerLeave(card('Midnight'))
    expect(stageBg()).toBe('#FCFBF8')
    expect(pill()).toBeNull()
  })

  it('previews on keyboard focus too', async () => {
    setup()
    await userEvent.click(themeButton())
    act(() => card('Sage').focus())
    expect(stageBg()).toBe('#F2F4EE')
    act(() => card('Sage').blur())
    expect(stageBg()).toBe('#FCFBF8')
  })

  it('applies on click as one undo step with a toast', async () => {
    const { store } = setup()
    const before = store.getState().deck.theme
    await userEvent.click(themeButton())
    await userEvent.click(card('Swiss'))
    expect(store.getState().deck.theme.source?.id).toBe('swiss')
    expect(card('Swiss')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Theme changed to Swiss')).toBeInTheDocument()
    const t = screen.getByText('Theme changed to Swiss').parentElement!
    await userEvent.click(within(t).getByRole('button', { name: 'Undo' }))
    expect(store.getState().deck.theme).toEqual(before)
    expect(store.getState().canUndo).toBe(false)
  })

  it('keeps an open text edit when a theme is applied', async () => {
    const { store, deck, text } = setup()
    act(() => {
      store.select({ slideId: deck.slides[0].id, ids: [text.id] })
      store.setEditing(text.id)
    })
    await userEvent.click(themeButton())
    const editor = document.querySelector<HTMLElement>('[data-text-editor]')!
    for (const ch of 'Hello') {
      act(() => {
        editor.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true }))
      })
    }
    await userEvent.click(card('Sage'))
    const el = store.getState().deck.slides[0].elements.find((e) => e.id === text.id) as TextEl
    expect(el.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('')).toContain('Hello')
    expect(store.getState().deck.theme.id).toBe('sage')
    expect(store.getState().editingId).toBeNull()
  })

  it('shows the brand-kit-changed notice and updates the deck', async () => {
    const kitTheme = { ...builtinTheme('sage')!, id: 'k1', name: 'Acme Co.', source: null }
    const kit: BrandKit = { id: 'k1', theme: kitTheme, createdAt: 1, updatedAt: 2 }
    const kv = createMemoryStore()
    await kv.putKit(kit)
    await loadKits(kv)
    const { store } = setup((d) => {
      d.theme = { ...structuredClone(OPENDECK_THEME), name: 'Acme Co.', id: 'k1', source: { kind: 'kit', id: 'k1', name: 'Acme Co.', updatedAt: 1 } }
    })
    await userEvent.click(themeButton())
    const notice = () => within(panel()).queryByText((_, el) => el?.textContent === 'Acme Co. was updated since this deck used it. Update this deck' && el.tagName === 'SPAN')
    expect(notice()).not.toBeNull()
    expect(within(panel()).getByText('Brand kit')).toBeInTheDocument()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Update this deck' }))
    expect(store.getState().deck.theme).toEqual(themeFromKit(kit))
    expect(notice()).toBeNull()
    act(() => store.undo())
    expect(notice()).not.toBeNull()
  })

  it('opens the theme editor from Customize and Create brand kit', async () => {
    setup()
    await userEvent.click(themeButton())
    await userEvent.click(within(panel()).getByRole('button', { name: 'Customize' }))
    expect(screen.getByRole('heading', { name: "This deck's theme" })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Create brand kit' }))
    expect(screen.getByRole('heading', { name: 'New brand kit' })).toBeInTheDocument()
    expect(screen.getByText('Starts from OpenDeck')).toBeInTheDocument()
  })

  it('marks a customized deck: no card checked, and updating from its kit says it replaces the changes', async () => {
    const kitTheme = { ...builtinTheme('sage')!, id: 'k1', name: 'Acme Co.', source: null }
    const kit: BrandKit = { id: 'k1', theme: kitTheme, createdAt: 1, updatedAt: 2 }
    const kv = createMemoryStore()
    await kv.putKit(kit)
    await loadKits(kv)
    const { store } = setup((d) => {
      d.theme = { ...themeFromKit({ ...kit, updatedAt: 1 }), radius: 46 }
      d.theme.source = { ...d.theme.source!, customized: true }
    })
    await userEvent.click(themeButton())
    expect(within(panel()).getByText('Customized')).toBeInTheDocument()
    expect(within(panel()).queryByText('Brand kit')).toBeNull()
    expect(card('Acme Co.')).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(within(panel()).getByRole('button', { name: 'Update this deck and replace your changes' }))
    expect(store.getState().deck.theme).toEqual(themeFromKit(kit))
  })

  it('does nothing when the theme the deck already uses is clicked', async () => {
    const { store } = setup()
    await userEvent.click(themeButton())
    expect(card('OpenDeck')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(card('OpenDeck'))
    expect(store.getState().canUndo).toBe(false)
    expect(screen.queryByText('Theme changed to OpenDeck')).toBeNull()
  })

  it('resets a customized deck when its own theme card is clicked', async () => {
    const { store } = setup((d) => {
      d.theme = { ...builtinTheme('swiss')!, radius: 46 }
      d.theme.source = { ...d.theme.source!, customized: true }
    })
    await userEvent.click(themeButton())
    expect(card('Swiss')).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(card('Swiss'))
    expect(store.getState().deck.theme).toEqual(builtinTheme('swiss'))
    expect(card('Swiss')).toHaveAttribute('aria-pressed', 'true')
  })

  it('brings a deck up to date when its brand kit card is clicked after the kit changed', async () => {
    const kitTheme = { ...builtinTheme('sage')!, id: 'k1', name: 'Acme Co.', source: null }
    const kit: BrandKit = { id: 'k1', theme: kitTheme, createdAt: 1, updatedAt: 2 }
    const kv = createMemoryStore()
    await kv.putKit(kit)
    await loadKits(kv)
    const { store } = setup((d) => {
      d.theme = themeFromKit({ ...kit, theme: { ...kitTheme, radius: 0 }, updatedAt: 1 })
    })
    await userEvent.click(themeButton())
    await userEvent.click(card('Acme Co.'))
    expect(store.getState().deck.theme).toEqual(themeFromKit(kit))
  })
})

