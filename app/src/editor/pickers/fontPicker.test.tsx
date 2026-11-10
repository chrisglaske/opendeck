import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetUploadedFonts } from '../../fonts/uploadedFonts'
import { builtinTheme } from '../../model/builtinThemes'
import { createDeck, createText } from '../../model/factory'
import { applyTheme } from '../../model/themeOps'
import type { TextEl } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'
import { FontPicker } from './FontPicker'

afterEach(() => resetUploadedFonts())

const woff2 = (name: string, size = 64) => {
  const b = new Uint8Array(size)
  b.set([0x77, 0x4f, 0x46, 0x32])
  return new File([b], name, { type: 'font/woff2' })
}

function picker(props: Partial<Parameters<typeof FontPicker>[0]> = {}) {
  const onPick = vi.fn()
  render(<FontPicker value="Inter" roles={{ heading: 'Manrope', body: 'Inter' }} onPick={onPick} variant="quick" label="Font" {...props} />)
  return onPick
}

const open = (name = 'Font: Inter') => userEvent.click(screen.getByRole('button', { name }))
const fonts = () => within(screen.getByRole('menu', { name: 'Fonts' }))
const groupNames = () => fonts().getAllByRole('group').map((g) => g.getAttribute('aria-label'))
const item = (name: string) => fonts().getByRole('menuitemradio', { name: new RegExp(`^${name}(,|$)`) })

describe('FontPicker', () => {
  it('lists bundled fonts by kind with the theme roles tagged', async () => {
    const onPick = picker()
    await open()
    expect(groupNames()).toEqual(['Sans serif', 'Serif', 'Display', 'Mono'])
    expect(fonts().getAllByRole('menuitemradio')).toHaveLength(18)
    expect(item('Inter')).toHaveTextContent('Body')
    expect(item('Manrope')).toHaveTextContent('Heading')
    expect(item('Inter')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(item('Lora'))
    expect(onPick).toHaveBeenCalledWith('Lora')
    expect(screen.queryByRole('menu', { name: 'Fonts' })).toBeNull()
  })

  it('filters by search', async () => {
    picker()
    await open()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search fonts' }), 'ser')
    expect(fonts().getAllByRole('menuitemradio').map((i) => i.textContent)).toEqual(['Source Serif 4'])
  })

  it('moves through the list with the arrow keys and picks with Enter', async () => {
    const onPick = picker()
    await open()
    expect(screen.getByRole('searchbox', { name: 'Search fonts' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Inter')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onPick).toHaveBeenCalledWith('Manrope')
  })

  it('marks a font the deck uses but this browser lacks', async () => {
    picker({ value: 'Acme Sans', roles: { heading: 'Acme Sans', body: 'Inter' }, inUse: ['Acme Sans', 'Inter'] })
    await open('Font: Acme Sans')
    expect(groupNames()[0]).toBe('Uploaded')
    expect(item('Acme Sans')).toHaveTextContent('Missing · upload again')
  })

  it('uploads a font and shows it under Uploaded', async () => {
    picker()
    await open()
    await userEvent.upload(screen.getByLabelText('Font files'), [woff2('AcmeSans-Bold.woff2'), woff2('AcmeSans-Regular.woff2')])
    expect(await screen.findByText('Added')).toBeInTheDocument()
    expect(screen.getByText('Regular · Bold · 1 KB')).toBeInTheDocument()
    expect(groupNames()[0]).toBe('Uploaded')
    expect(within(fonts().getAllByRole('group')[0]).getByRole('menuitemradio', { name: /^Acme Sans/ })).toBeInTheDocument()
  })

  it('explains a file that is not a font', async () => {
    picker()
    await open()
    const pdf = new File([new TextEncoder().encode('%PDF-1.7')], 'logo-final.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Font files'), pdf, { applyAccept: false })
    expect(await screen.findByText('"logo-final.pdf" isn\'t a font.')).toBeInTheDocument()
    expect(screen.getByText('Use a .woff2, .woff, .ttf or .otf file up to 2 MB.')).toBeInTheDocument()
  })
})

describe('font on text', () => {
  it('a hand-picked font stays when the theme changes; a role font follows', async () => {
    const deck = createDeck('Fonts')
    const a: TextEl = { ...createText('title'), x: 100, y: 100 }
    const b: TextEl = { ...createText('title'), x: 100, y: 600 }
    deck.slides[0].elements = [a, b]
    const store = createEditorStore(deck)
    render(
      <EditorProvider store={store}>
        <EditorShell autosaver={createAutosaver(createMemoryStore())} />
      </EditorProvider>,
    )
    const els = () => store.getState().deck.slides[0].elements as TextEl[]
    const choose = async (id: string, from: string, to: string) => {
      act(() => store.select({ slideId: deck.slides[0].id, ids: [id] }))
      await userEvent.click(within(screen.getByRole('toolbar', { name: 'Text options' })).getByRole('button', { name: `Font: ${from}` }))
      await userEvent.click(item(to))
    }
    await choose(a.id, 'Manrope', 'Lora')
    expect(els()[0].fontFamily).toBe('Lora')
    await choose(b.id, 'Manrope', 'Lora')
    await choose(b.id, 'Lora', 'Manrope')
    expect(els()[1].fontFamily).toBeUndefined()
    expect(els()[1].font).toBeUndefined()
    act(() => store.apply((d) => applyTheme(d, builtinTheme('swiss')!)))
    const box = (id: string) => screen.getByRole('main', { name: 'Slide canvas' }).querySelector<HTMLElement>(`[data-el-id="${id}"]`)!
    expect(box(a.id).style.fontFamily).toContain('Lora')
    expect(box(b.id).style.fontFamily).toBe('var(--t-font-heading)')
    act(() => store.select({ slideId: deck.slides[0].id, ids: [b.id] }))
    expect(within(screen.getByRole('toolbar', { name: 'Text options' })).getByRole('button', { name: 'Font: Inter Tight' })).toBeInTheDocument()
  })
})
