import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createDeck, createImage, createLine, createLogo, createShape, createText } from '../../model/factory'
import type { ShapeEl, SlideElement, TextEl } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import type { EditorStore } from '../store'
import { LINK_ERROR } from '../pickers/LinkPopover'

function setup(elements: SlideElement[], select = true) {
  const deck = createDeck('Style')
  deck.slides[0].elements = elements
  const store = createEditorStore(deck)
  if (select) store.select({ slideId: deck.slides[0].id, ids: [elements[0].id] })
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={createAutosaver(createMemoryStore())} />
    </EditorProvider>,
  )
  return store
}

const first = <T extends SlideElement>(s: EditorStore) => s.getState().deck.slides[0].elements[0] as T
const panel = () => within(screen.getByRole('complementary', { name: 'Selection settings' }))
const bar = (name: string) => within(screen.getByRole('toolbar', { name }))

describe('Style tab', () => {
  it('sets a text style and drops the box size and font overrides', async () => {
    const t: TextEl = { ...createText('body'), size: 90, font: 'heading', fontFamily: 'Lora' }
    const s = setup([t])
    await userEvent.click(panel().getByRole('button', { name: /^Title/ }))
    expect(first<TextEl>(s)).toMatchObject({ style: 'title' })
    expect(first<TextEl>(s).size).toBeUndefined()
    expect(first<TextEl>(s).font).toBeUndefined()
    expect(first<TextEl>(s).fontFamily).toBeUndefined()
    expect(panel().getByRole('button', { name: /^Title/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not mark a style as chosen while the box has a hand-set font', () => {
    setup([{ ...createText('body'), fontFamily: 'Lora' }])
    expect(panel().getByRole('button', { name: /^Body/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('colors a whole selected text box with a theme color', async () => {
    const s = setup([createText('body')])
    await userEvent.click(panel().getByRole('button', { name: 'Accent' }))
    expect(first<TextEl>(s).color).toEqual({ theme: 'accent' })
  })

  it('shows letter spacing as a percentage and stores it in em', async () => {
    const s = setup([createText('body')])
    const f = panel().getByRole('spinbutton', { name: 'Letter spacing' })
    await userEvent.clear(f)
    await userEvent.type(f, '-2{Enter}')
    expect(first<TextEl>(s).letterSpacing).toBeCloseTo(-0.02)
  })

  it('turns auto-fit off', async () => {
    const s = setup([createText('body')])
    await userEvent.click(panel().getByRole('switch', { name: 'Auto-fit text' }))
    expect(first<TextEl>(s).autoFit).toBe(false)
  })

  it('sets a shape fill from a typed hex code, normalised', async () => {
    const s = setup([createShape('rect')])
    await userEvent.click(panel().getByRole('button', { name: /^Fill color/ }))
    const dialog = within(screen.getByRole('dialog', { name: 'Fill color' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Mix a custom color' }))
    const hex = dialog.getByRole('textbox', { name: 'Hex color' })
    await userEvent.clear(hex)
    await userEvent.type(hex, '0f7{Enter}')
    expect(first<ShapeEl>(s).fill).toEqual({ hex: '#00FF77' })
  })

  it('removes a shape fill with "No fill"', async () => {
    const s = setup([createShape('rect')])
    await userEvent.click(panel().getByRole('button', { name: /^Fill color/ }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Fill color' })).getByRole('button', { name: 'No fill' }))
    expect(first<ShapeEl>(s).fill).toBeNull()
  })
})

describe('text quick bar', () => {
  it('links the whole box, adding https:// to a bare address', async () => {
    const s = setup([createText('body')])
    await userEvent.click(bar('Text options').getByRole('button', { name: 'Link' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Link address' }), 'example.com{Enter}')
    expect(first<TextEl>(s).paragraphs[0].runs[0].href).toBe('https://example.com')
  })

  it('refuses a link that is not web or email, and explains why', async () => {
    const s = setup([createText('body')])
    await userEvent.click(bar('Text options').getByRole('button', { name: 'Link' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Link address' }), 'ftp://files.example.com{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(LINK_ERROR)
    expect(first<TextEl>(s).paragraphs[0].runs[0].href).toBeUndefined()
  })

  it('makes a selected box bold and shows it pressed', async () => {
    const s = setup([createText('body')])
    await userEvent.click(bar('Text options').getByRole('button', { name: 'Bold' }))
    expect(first<TextEl>(s).paragraphs[0].runs[0].bold).toBe(true)
    expect(bar('Text options').getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches the font by role', async () => {
    const s = setup([createText('body')])
    await userEvent.click(bar('Text options').getByRole('button', { name: 'Font: Inter' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Manrope/ }))
    expect(first<TextEl>(s).font).toBe('heading')
  })
})

describe('slide background', () => {
  it('takes a custom color', async () => {
    const s = setup([createShape('rect')], false)
    await userEvent.click(screen.getByRole('button', { name: /^Custom background color/ }))
    const dialog = within(screen.getByRole('dialog', { name: 'Custom background color' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Mix a custom color' }))
    const hex = dialog.getByRole('textbox', { name: 'Hex color' })
    await userEvent.clear(hex)
    await userEvent.type(hex, '#2E6FD8{Enter}')
    expect(s.getState().deck.slides[0].background.color).toEqual({ hex: '#2E6FD8' })
  })
})

describe('theme-bound style', () => {
  it('shape corners follow the theme until set by hand', async () => {
    const s = setup([createShape('rect')])
    const field = () => panel().getByRole('spinbutton', { name: 'Corner radius' })
    expect(field()).toHaveValue('27')
    expect(panel().getByText('From theme')).toBeInTheDocument()
    expect(panel().queryByRole('button', { name: 'Use theme corners' })).toBeNull()
    await userEvent.clear(field())
    await userEvent.type(field(), '10{Enter}')
    expect(first<ShapeEl>(s).radius).toBe(10)
    expect(panel().queryByText('From theme')).toBeNull()
    await userEvent.click(panel().getByRole('button', { name: 'Use theme corners' }))
    expect(first<ShapeEl>(s).radius).toBe('theme')
    expect(field()).toHaveValue('27')
  })

  it('a logo explains that it follows the theme', async () => {
    setup([createLogo()])
    expect(panel().getByText('Follows theme')).toBeInTheDocument()
    await userEvent.click(panel().getByRole('button', { name: 'Add a logo to the theme' }))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: "This deck's theme" })).toBeInTheDocument()
  })
})

describe('Effects', () => {
  const pic = (): SlideElement => ({ ...createImage('a1', { w: 400, h: 300 }) })

  it('sets opacity as one undo step', async () => {
    const s = setup([createShape('rect')])
    const f = panel().getByRole('spinbutton', { name: 'Opacity' })
    await userEvent.clear(f)
    await userEvent.type(f, '40{Enter}')
    expect(first<ShapeEl>(s).opacity).toBe(0.4)
    s.undo()
    expect(first<ShapeEl>(s).opacity).toBeUndefined()
  })

  it('stores full opacity as no opacity and never goes below 5%', async () => {
    const s = setup([{ ...createShape('rect'), opacity: 0.5 }])
    const f = panel().getByRole('spinbutton', { name: 'Opacity' })
    await userEvent.clear(f)
    await userEvent.type(f, '1{Enter}')
    expect(first<ShapeEl>(s).opacity).toBe(0.05)
    await userEvent.clear(f)
    await userEvent.type(f, '100{Enter}')
    expect(first<ShapeEl>(s).opacity).toBeUndefined()
  })

  it('drags the opacity slider as one undo step', () => {
    const s = setup([createShape('rect')])
    const slider = panel().getByRole('slider', { name: 'Opacity' })
    fireEvent.change(slider, { target: { value: '80' } })
    fireEvent.change(slider, { target: { value: '60' } })
    expect(first<ShapeEl>(s).opacity).toBe(0.6)
    s.undo()
    expect(first<ShapeEl>(s).opacity).toBeUndefined()
  })

  it('turns the shadow on and off', async () => {
    const s = setup([createText('body')])
    await userEvent.click(panel().getByRole('switch', { name: 'Shadow' }))
    expect(first<TextEl>(s).shadow).toBe(true)
    await userEvent.click(panel().getByRole('switch', { name: 'Shadow' }))
    expect(first<TextEl>(s).shadow).toBeUndefined()
  })

  it('switches a shape fill to a fade toward the top', async () => {
    const s = setup([createShape('rect')])
    await userEvent.click(panel().getByRole('radio', { name: 'Fade' }))
    expect(first<ShapeEl>(s).fade).toBe('up')
    expect(panel().getByRole('button', { name: 'Fades toward top' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(panel().getByRole('button', { name: 'Fades toward bottom' }))
    expect(first<ShapeEl>(s).fade).toBe('down')
    await userEvent.click(panel().getByRole('radio', { name: 'Solid' }))
    expect(first<ShapeEl>(s).fade).toBeUndefined()
    expect(panel().queryByRole('button', { name: 'Fades toward top' })).toBeNull()
  })

  it('offers effects but no fade for images', () => {
    setup([pic()])
    expect(panel().getByRole('spinbutton', { name: 'Opacity' })).toBeInTheDocument()
    expect(panel().getByRole('switch', { name: 'Shadow' })).toBeInTheDocument()
    expect(panel().queryByRole('radio', { name: 'Fade' })).toBeNull()
  })

  it('offers no effects for lines and icons', () => {
    setup([createLine()])
    expect(panel().queryByRole('spinbutton', { name: 'Opacity' })).toBeNull()
  })
})
