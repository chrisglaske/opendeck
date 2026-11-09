import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck, createText } from '../../model/factory'
import type { TextEl } from '../../model/types'
import { createAutosaver } from '../../storage/autosave'
import { createMemoryStore } from '../../storage/deckStore'
import { resetMyTemplates } from '../../storage/templates'
import { TEMPLATE_FORMAT, TEMPLATE_VERSION } from '../../templates/templateData'
import { templateFileName } from '../download'
import { ToastHost } from '../../ui'
import { EditorProvider } from '../EditorContext'
import { EditorShell } from '../EditorShell'
import { createEditorStore } from '../store'

const shared = vi.hoisted(() => ({ store: null as unknown }))
vi.mock('../../storage/appStore', () => ({ getDeckStore: () => Promise.resolve(shared.store) }))

afterEach(() => {
  resetMyTemplates()
  localStorage.clear()
  vi.restoreAllMocks()
})

function setup() {
  shared.store = createMemoryStore()
  const deck = createDeck('Q3 Board update')
  const text: TextEl = { ...createText('title'), role: 'title' }
  text.paragraphs = [{ runs: [{ text: 'Why customers stay' }], align: 'left', list: 'none' }]
  deck.slides[0].elements = [text]
  const store = createEditorStore(deck)
  render(
    <EditorProvider store={store}>
      <EditorShell autosaver={createAutosaver(createMemoryStore())} />
      <ToastHost />
    </EditorProvider>,
  )
  return { store, deck, memory: shared.store as ReturnType<typeof createMemoryStore> }
}

const thumbs = () => within(screen.getByRole('listbox', { name: 'Slides' })).getAllByRole('option')
const panel = () => screen.getByRole('complementary', { name: 'Add slide' })

async function saveAs(name: string) {
  const dialog = await screen.findByRole('dialog', { name: 'Save as template' })
  const field = within(dialog).getByRole('textbox', { name: 'Name' })
  expect(field).toHaveValue('Untitled template')
  await userEvent.clear(field)
  await userEvent.type(field, name)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save template' }))
}

describe('my templates', () => {
  it('saves the current slide from the rail menu', async () => {
    const { memory } = setup()
    fireEvent.contextMenu(thumbs()[0])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Save slide as template' }))
    await saveAs('Customer story')
    expect(await screen.findByText('Saved template', { exact: false })).toHaveTextContent('Saved template Customer story')
    expect(screen.queryByRole('dialog', { name: 'Save as template' })).toBeNull()
    await waitFor(async () => expect(await memory.listTemplates()).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Add slide' }))
    const mine = within(panel()).getByRole('grid', { name: 'My templates' })
    expect(within(mine).getByRole('button', { name: 'Customer story' })).toBeInTheDocument()
  })

  it('offers saving only for a single slide', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Add slide' }))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Blank' }))
    expect(store.getState().deck.slides).toHaveLength(2)
    fireEvent.click(thumbs()[0])
    fireEvent.click(thumbs()[1], { shiftKey: true })
    expect(thumbs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'true'])
    fireEvent.contextMenu(thumbs()[1])
    expect(screen.getByRole('menuitem', { name: /Delete 2 slides/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Save slide as template' })).toBeNull()
  })

  it('saves from right-click on the empty canvas', async () => {
    setup()
    const frame = document.querySelector('[data-slide-frame]')!
    fireEvent.contextMenu(frame, { clientX: 5, clientY: 5 })
    expect(screen.getByRole('menu', { name: 'Slide actions' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Save slide as template' }))
    await saveAs('From canvas')
    expect(await screen.findByText('Saved template', { exact: false })).toHaveTextContent('From canvas')
  })

  it('renames and deletes with a confirm, leaving slides unchanged', async () => {
    const { store } = setup()
    fireEvent.contextMenu(thumbs()[0])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Save slide as template' }))
    await saveAs('Customer story')
    await userEvent.click(screen.getByRole('button', { name: 'Add slide' }))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Customer story' }))
    const made = store.getState().deck.slides[1]
    expect(made.layout).toMatch(/^mine:/)

    await userEvent.click(within(panel()).getByRole('button', { name: 'Customer story options' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const dialog = screen.getByRole('dialog', { name: 'Rename template' })
    const field = within(dialog).getByRole('textbox', { name: 'Name' })
    expect(field).toHaveValue('Customer story')
    await userEvent.clear(field)
    await userEvent.type(field, 'Case study')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }))
    expect(within(panel()).getByRole('button', { name: 'Case study' })).toBeInTheDocument()

    await userEvent.click(within(panel()).getByRole('button', { name: 'Case study options' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete "Case study"?' })
    expect(confirm).toHaveTextContent('Slides made from it stay as they are.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(within(panel()).queryByRole('button', { name: 'Case study' })).toBeNull()
    expect(store.getState().deck.slides[1]).toEqual(made)

    await userEvent.click(within(panel()).getByRole('button', { name: 'Close' }))
    expect(screen.getByText('No layout')).toBeInTheDocument()
  })

  it('shows the saved template name in the Slide tab of slides made from it', async () => {
    setup()
    fireEvent.contextMenu(thumbs()[0])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Save slide as template' }))
    await saveAs('Customer story')
    await userEvent.click(screen.getByRole('button', { name: 'Add slide' }))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Customer story' }))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Close' }))
    expect(screen.getByText('Customer story')).toBeInTheDocument()
    expect(screen.getByText('My templates')).toBeInTheDocument()
  })

  it('exports a saved template as a file', async () => {
    setup()
    fireEvent.contextMenu(thumbs()[0])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Save slide as template' }))
    await saveAs('Customer story')
    const url = vi.fn((_: Blob) => 'blob:template')
    URL.createObjectURL = url
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Customer story.odtemplate')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Add slide' }))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Customer story options' }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Rename', 'Export as file', 'Delete'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Export as file' }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(JSON.parse(await url.mock.calls[0][0].text())).toMatchObject({ format: TEMPLATE_FORMAT, template: { name: 'Customer story' } })
  })

  it('gives template files a safe name', () => {
    expect(templateFileName('Acme / story')).toBe('Acme story.odtemplate')
    expect(templateFileName('///')).toBe('template.odtemplate')
  })

  it('imports template files and reports bad ones', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Add slide' }))
    const input = () => screen.getByLabelText<HTMLInputElement>('Template files')
    expect(input()).toHaveAttribute('accept', '.odtemplate,application/json')
    expect(input()).toHaveAttribute('multiple')
    const good = (name: string) =>
      new File([JSON.stringify({ format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, template: { id: 'x', name, slide: { elements: [] } }, assets: [] })], `${name}.odtemplate`)

    await userEvent.click(within(panel()).getByRole('button', { name: 'Import' }))
    await userEvent.upload(input(), good('Imported'))
    expect(await screen.findByText(/^Added template/)).toHaveTextContent('Added template Imported')
    const mine = () => within(panel()).getByRole('grid', { name: 'My templates' })
    expect(within(mine()).getByRole('button', { name: 'Imported' })).toBeInTheDocument()

    await userEvent.upload(input(), [good('One'), good('Two'), new File(['{}'], 'bad.odtemplate')])
    expect(await screen.findByText(/^Added 2 templates/)).toHaveTextContent("Added 2 templates · 1 file couldn't be used")

    await userEvent.upload(input(), new File(['{}'], 'empty.odtemplate'))
    expect(await screen.findByText("That file isn't a template OpenDeck can use")).toBeInTheDocument()
    await userEvent.upload(input(), new File([JSON.stringify({ format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION + 1 })], 'new.odtemplate'))
    expect(await screen.findByText('That template was made by a newer version of OpenDeck')).toBeInTheDocument()
  })
})
