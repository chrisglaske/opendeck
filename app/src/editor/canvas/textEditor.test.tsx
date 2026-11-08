import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { createDeck, createText } from '../../model/factory'
import type { TextEl } from '../../model/types'
import { EditorProvider } from '../EditorContext'
import { isMac } from '../shortcuts'
import { Stage } from '../Stage'
import { createEditorStore } from '../store'
import type { EditorStore } from '../store'

function textBox(text: string): TextEl {
  return { ...createText('body'), x: 100, y: 100, paragraphs: [{ runs: [{ text }], align: 'left', list: 'none' }] }
}

/** Renders the canvas with one text box already in edit mode. */
function setup(el: TextEl) {
  const deck = createDeck('Text')
  deck.slides[0].elements = [el]
  const store = createEditorStore(deck)
  store.select({ slideId: deck.slides[0].id, ids: [el.id] })
  store.setEditing(el.id)
  render(
    <EditorProvider store={store}>
      <Stage zoom={100} onZoom={() => {}} panelHidden={false} onShowPanel={() => {}} />
    </EditorProvider>,
  )
  return store
}

const editor = () => document.querySelector<HTMLElement>('[data-text-editor]')!
const textOf = (s: EditorStore, id: string) => {
  const el = s.getState().deck.slides[0].elements.find((e) => e.id === id) as TextEl | undefined
  return el?.paragraphs
}

/** Puts the DOM selection over characters [a, b) of the first paragraph. */
function selectChars(a: number, b = a) {
  const p = editor().querySelector('[data-p]')!
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  const locate = (o: number): [Node, number] => {
    for (const n of nodes) {
      if (o <= n.length) return [n, o]
      o -= n.length
    }
    return [p, p.childNodes.length]
  }
  const r = document.createRange()
  r.setStart(...locate(a))
  r.setEnd(...locate(b))
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(r)
}

function input(inputType: string, data: string | null = null) {
  const e = new InputEvent('beforeinput', { inputType, data, bubbles: true, cancelable: true })
  act(() => {
    editor().dispatchEvent(e)
  })
  return e
}

const modKey = (k: string) => fireEvent.keyDown(editor(), { key: k, metaKey: isMac, ctrlKey: !isMac })

describe('text editor', () => {
  it('types into an empty box as one run and one undo step', () => {
    const el = textBox('')
    const s = setup(el)
    selectChars(0)
    expect(input('insertText', 'H').defaultPrevented).toBe(true)
    input('insertText', 'i')
    expect(textOf(s, el.id)![0].runs).toEqual([{ text: 'Hi' }])
    s.undo()
    expect(textOf(s, el.id)![0].runs).toEqual([{ text: '' }])
    expect(s.getState().canUndo).toBe(false)
  })

  it('renders the same paragraph and run markup as the slide', () => {
    setup(textBox('Hello'))
    expect(editor().getAttribute('contenteditable')).toBe('true')
    expect(editor().querySelector('p[data-p] span[data-r]')?.textContent).toBe('Hello')
  })

  it('makes the selected characters bold with the shortcut', () => {
    const el = textBox('Hello')
    const s = setup(el)
    selectChars(1, 4)
    modKey('b')
    expect(textOf(s, el.id)![0].runs).toEqual([{ text: 'H' }, { text: 'ell', bold: true }, { text: 'o' }])
  })

  it('pastes plain text only', () => {
    const el = textBox('')
    const s = setup(el)
    selectChars(0)
    const data: Record<string, string> = { 'text/html': '<b onclick="alert(1)">x</b><script>alert(2)</script>', 'text/plain': 'x' }
    fireEvent.paste(editor(), { clipboardData: { types: Object.keys(data), getData: (t: string) => data[t] ?? '' } })
    expect(textOf(s, el.id)).toEqual([{ runs: [{ text: 'x' }], align: 'left', list: 'none' }])
    expect(editor().querySelector('b, script')).toBeNull()
  })

  it('leaves edit mode on Esc and keeps the box selected', () => {
    const el = textBox('Hello')
    const s = setup(el)
    selectChars(0)
    fireEvent.keyDown(editor(), { key: 'Escape' })
    expect(s.getState().editingId).toBeNull()
    expect(s.getState().selection.ids).toEqual([el.id])
    expect(document.querySelector('[data-text-editor]')).toBeNull()
  })

  it('deletes a box left empty, and one undo brings it back with its text', () => {
    const el = textBox('Hi')
    const s = setup(el)
    selectChars(0, 2)
    input('deleteContentBackward')
    expect(textOf(s, el.id)![0].runs).toEqual([{ text: '' }])
    fireEvent.keyDown(editor(), { key: 'Escape' })
    expect(textOf(s, el.id)).toBeUndefined()
    s.undo()
    expect(textOf(s, el.id)![0].runs).toEqual([{ text: 'Hi' }])
  })

  it('splits the paragraph on Enter', () => {
    const el = textBox('abcd')
    const s = setup(el)
    selectChars(2)
    input('insertParagraph')
    expect(textOf(s, el.id)!.map((p) => p.runs[0].text)).toEqual(['ab', 'cd'])
    expect(editor().querySelectorAll('[data-p]')).toHaveLength(2)
  })

  it('opens a new text box for typing with the placeholder selected', () => {
    const deck = createDeck('Text')
    const store = createEditorStore(deck)
    render(
      <EditorProvider store={store}>
        <Stage zoom={100} onZoom={() => {}} panelHidden={false} onShowPanel={() => {}} />
      </EditorProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const id = store.getState().editingId!
    expect(id).toBeTruthy()
    expect(window.getSelection()!.toString()).toBe('Type something')
    input('insertText', 'Q')
    expect(textOf(store, id)![0].runs).toEqual([{ text: 'Q' }])
  })

  it('starts editing when typing on a selected text box', () => {
    const el = textBox('Hi')
    const deck = createDeck('Text')
    deck.slides[0].elements = [el]
    const store = createEditorStore(deck)
    store.select({ slideId: deck.slides[0].id, ids: [el.id] })
    render(
      <EditorProvider store={store}>
        <Stage zoom={100} onZoom={() => {}} panelHidden={false} onShowPanel={() => {}} />
      </EditorProvider>,
    )
    fireEvent.keyDown(document.body, { key: 't' })
    expect(store.getState().editingId).toBe(el.id)
    expect(textOf(store, el.id)![0].runs).toEqual([{ text: 'Hit' }])
    expect(store.getState().deck.slides[0].elements).toHaveLength(1)
  })

  it('stops editing when something else is selected, deleting a box left empty', () => {
    const el = textBox('Hi')
    const s = setup(el)
    selectChars(0, 2)
    input('deleteContentBackward')
    fireEvent.click(screen.getByRole('button', { name: 'Shape' }))
    expect(s.getState().editingId).toBeNull()
    const kinds = s.getState().deck.slides[0].elements.map((e) => e.type)
    expect(kinds).toEqual(['shape'])
    expect(document.querySelector('[data-text-editor]')).toBeNull()
  })

  it('selects the placeholder and types once under StrictMode (effects run twice in development)', () => {
    const store = createEditorStore(createDeck('Text'))
    render(
      <StrictMode>
        <EditorProvider store={store}>
          <Stage zoom={100} onZoom={() => {}} panelHidden={false} onShowPanel={() => {}} />
        </EditorProvider>
      </StrictMode>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    expect(window.getSelection()!.toString()).toBe('Type something')
    const id = store.getState().editingId!
    fireEvent.keyDown(editor(), { key: 'Escape' })
    fireEvent.keyDown(document.body, { key: 'x' })
    expect(textOf(store, id)![0].runs).toEqual([{ text: 'Type somethingx' }])
  })

  it('uses the live selection when a bar button is pressed right after selecting', () => {
    const el = textBox('Hello')
    const s = setup(el)
    selectChars(1, 4) // no selectionchange has been handled yet
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Text options' })).getByRole('button', { name: 'Italic' }))
    expect(textOf(s, el.id)![0].runs).toEqual([{ text: 'H' }, { text: 'ell', italic: true }, { text: 'o' }])
  })
})
