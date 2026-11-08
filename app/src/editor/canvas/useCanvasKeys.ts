import { useEffect, useRef } from 'react'
import { moveElement } from '../../model/geometry'
import { elementCommands } from '../commands'
import { useEditorStore } from '../EditorContext'
import { isMac, isTypingTarget } from '../shortcuts'
import { enterTextEditing } from './textSession'
import { slideOf, writeBack } from './useCanvasGestures'
import { worldItem, worldItems } from './world'

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}

/** Focus inside these widgets keeps arrow keys, Delete and Esc for itself. */
const OWN_KEYS = '[role="listbox"],[role="tablist"],[role="menu"],[role="radiogroup"],[role="dialog"],[role="slider"]'

/** The one selected text box that typing would go into, if any. */
function selectedText(store: ReturnType<typeof useEditorStore>) {
  const st = store.getState()
  const ids = st.selection.ids
  if (st.editingId || ids.length !== 1) return null
  const item = worldItem(slideOf(st), ids[0])
  return item && item.el.type === 'text' && !item.locked ? item.id : null
}

const ownsKeys = (t: EventTarget | null) => isTypingTarget(t) || (t instanceof Element && t.closest(OWN_KEYS) !== null)

/**
 * Keyboard commands for the canvas selection: nudge, delete, select all, Esc,
 * duplicate, group, layer order, the context menu key, and Enter or typing to
 * edit a selected text box. Text fields, open menus and lists keep their own keys.
 */
export function useCanvasKeys(onMenuKey: () => void) {
  const store = useEditorStore()
  const menu = useRef(onMenuKey)
  menu.current = onMenuKey

  useEffect(() => {
    const cmd = elementCommands(store)
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      const st = store.getState()
      if (st.editingId) return
      if (ownsKeys(e.target)) return
      const slide = slideOf(st)
      const ids = st.selection.ids
      const sid = slide.id
      const mod = isMac ? e.metaKey : e.ctrlKey
      const k = e.key.toLowerCase()
      const run = (fn: () => void) => {
        e.preventDefault()
        fn()
      }
      const arrow = ARROWS[e.key]

      const text = selectedText(store)
      if (text && e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey) {
        run(() => enterTextEditing(store, text, { mode: 'end' }))
      } else if (arrow && !mod && !e.altKey) {
        const items = worldItems(slide, ids).filter((i) => !i.locked)
        if (items.length === 0) return
        const n = e.shiftKey ? 10 : 1
        const next = new Map(items.map((i) => [i.id, i.toLocal(moveElement(i.el, arrow[0] * n, arrow[1] * n))]))
        run(() => store.apply(writeBack(sid, next), { coalesce: `nudge:${ids.join(',')}` }))
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !mod && ids.length) {
        run(cmd.remove)
      } else if (mod && !e.shiftKey && !e.altKey && k === 'a') {
        run(() => store.select({ slideId: sid, ids: slide.elements.filter((el) => !el.locked).map((el) => el.id) }))
      } else if (e.key === 'Escape' && ids.length) {
        const parent = worldItem(slide, ids[0])?.parentId
        run(() => store.select({ slideId: sid, ids: parent ? [parent] : [] }))
      } else if (!ids.length) {
        return
      } else if (mod && !e.altKey && !e.shiftKey && k === 'd') {
        run(cmd.duplicate)
      } else if (mod && !e.altKey && k === 'g') {
        run(e.shiftKey ? cmd.ungroup : cmd.group)
      } else if (mod && !e.altKey && (e.code === 'BracketRight' || e.code === 'BracketLeft')) {
        const up = e.code === 'BracketRight'
        run(() => cmd.reorder(e.shiftKey ? (up ? 'front' : 'back') : up ? 'forward' : 'backward'))
      } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        run(menu.current)
      }
    }
    // Typing on a selected text box starts editing with that character. This runs
    // first so single-letter insert shortcuts don't take the key.
    const onType = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.key.length !== 1 || e.metaKey || e.ctrlKey) return
      if (ownsKeys(e.target)) return
      const text = selectedText(store)
      if (!text) return
      e.preventDefault()
      e.stopPropagation()
      enterTextEditing(store, text, { mode: 'type', text: e.key })
    }
    window.addEventListener('keydown', onType, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onType, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [store])
}
