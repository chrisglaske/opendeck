import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { findElement } from '../../model/ops'
import {
  allRange,
  applyMarks,
  deleteRange,
  insertText,
  isCollapsed,
  linkRangeAt,
  marksAt,
  splitParagraph,
  step,
} from '../../model/richtext'
import type { Edit, Marks, TextPos, TextRange } from '../../model/richtext'
import { textStyleOf } from '../../model/theme'
import type { Theme } from '../../model/theme'
import type { Paragraph, TextEl } from '../../model/types'
import { renderParagraphs, textBoxStyle } from '../../render/elements/TextView'
import { useAutoFit } from '../../render/useAutoFit'
import { useEditorStore } from '../EditorContext'
import { isMac } from '../shortcuts'
import { enterTextEditing, publishSession, requestLinkEditor, takeEntry } from './textSession'
import slide from '../../render/SlideView.module.css'
import s from './TextEditor.module.css'

/** Longest text a single paste adds. */
const MAX_PASTE = 10000

type Props = {
  el: TextEl
  theme: Theme
  /** Saves new paragraphs; `coalesce` groups typing into one undo step. */
  onCommit(paragraphs: Paragraph[], coalesce?: string): void
  onExit(): void
}

// ── DOM ⇄ model positions ──────────────────────────────────────────────

const paraEls = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[data-p]'))

/** The model position of a DOM point inside the editor, or null when it is outside. */
function toPos(root: HTMLElement, node: Node, offset: number): TextPos | null {
  if (!root.contains(node)) return null
  const host = node instanceof Element ? node : node.parentElement
  const pEl = host?.closest<HTMLElement>('[data-p]')
  if (pEl && root.contains(pEl)) {
    const r = document.createRange()
    r.selectNodeContents(pEl)
    r.setEnd(node, offset)
    return { p: Number(pEl.dataset.p), o: r.toString().length }
  }
  // Between paragraphs (on the editor or a list): the nearest paragraph edge.
  const ps = paraEls(root)
  const child = node.childNodes[offset]
  const next = child && ps.find((p) => child === p || child.contains(p) || (child.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
  if (next) return { p: Number(next.dataset.p), o: 0 }
  const last = ps[ps.length - 1]
  return last ? { p: Number(last.dataset.p), o: (last.textContent ?? '').length } : { p: 0, o: 0 }
}

/** The DOM point for a model position. At a run boundary it stays in the earlier run. */
function toPoint(root: HTMLElement, pos: TextPos): [Node, number] | null {
  const pEl = root.querySelector<HTMLElement>(`[data-p="${pos.p}"]`)
  if (!pEl) return null
  const walker = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT)
  let o = pos.o
  let last: Text | null = null
  while (walker.nextNode()) {
    const t = walker.currentNode as Text
    if (o <= t.length) return [t, o]
    o -= t.length
    last = t
  }
  return last ? [last, last.length] : [pEl, 0]
}

function readRange(root: HTMLElement): TextRange | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const start = toPos(root, sel.anchorNode!, sel.anchorOffset)
  const end = toPos(root, sel.focusNode!, sel.focusOffset)
  return start && end ? { start, end } : null
}

function writeRange(root: HTMLElement, r: TextRange) {
  const a = toPoint(root, r.start), b = toPoint(root, r.end)
  const sel = window.getSelection()
  if (!a || !b || !sel) return
  sel.setBaseAndExtent(a[0], a[1], b[0], b[1])
}

/** A browser-supplied target range (word delete, spellcheck), mapped to the model. */
function targetRange(root: HTMLElement, e: InputEvent): TextRange | null {
  const t = e.getTargetRanges?.()[0]
  if (!t) return null
  const start = toPos(root, t.startContainer, t.startOffset)
  const end = toPos(root, t.endContainer, t.endOffset)
  return start && end ? { start, end } : null
}

function caretFromPoint(root: HTMLElement, x: number, y: number): TextPos | null {
  const doc = document as Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null }
  const cp = doc.caretPositionFromPoint?.(x, y)
  if (cp) return toPos(root, cp.offsetNode, cp.offset)
  const cr = document.caretRangeFromPoint?.(x, y)
  return cr ? toPos(root, cr.startContainer, cr.startOffset) : null
}

const merge = (base: Marks, extra: Marks): Marks => {
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete out[k]
    else out[k] = v
  }
  return out as Marks
}

const samePos = (a: TextPos, b: TextPos) => a.p === b.p && a.o === b.o

/**
 * Edits a text box in place. The browser never changes the markup: every
 * edit goes through the paragraph/run model and the box is drawn again from
 * it, so editing looks exactly like the slide and writes no inline styles.
 * IME composition is the exception; the composed text is committed when it ends.
 */
export function TextEditor({ el, theme, onCommit, onExit }: Props) {
  const store = useEditorStore()
  const root = useRef<HTMLDivElement>(null)
  const range = useRef<TextRange>(allRange(el.paragraphs))
  const pending = useRef<{ at: TextPos; marks: Marks } | null>(null)
  const composing = useRef<TextRange | null>(null)
  /** Bumped to redraw the text from scratch after IME composition changed the DOM. */
  const [rev, setRev] = useState(0)
  const t = textStyleOf(el, theme)
  const fit = useAutoFit(root, [el.paragraphs, el.w, el.h, t.fontFamily, t.size, t.lineHeight, t.letterSpacing, theme.fonts, rev], el.autoFit)

  const paragraphs = (): Paragraph[] => {
    const st = store.getState()
    const sl = st.deck.slides.find((x) => x.id === st.selection.slideId)
    const cur = sl && findElement(sl, el.id)?.el
    return cur?.type === 'text' ? cur.paragraphs : el.paragraphs
  }

  const pendingMarks = () => {
    const p = pending.current
    return p && isCollapsed(range.current) && samePos(p.at, range.current.start) ? p.marks : null
  }

  /**
   * Takes the selection from the page when it is in the text. `selectionchange`
   * arrives late, so commands read the live selection rather than wait for it.
   */
  const sync = () => {
    const r = root.current && readRange(root.current)
    if (r) range.current = r
  }

  const mark = (m: Marks) => {
    sync()
    if (isCollapsed(range.current)) {
      pending.current = { at: range.current.start, marks: { ...(pendingMarks() ?? {}), ...m } }
      publish()
    } else onCommit(applyMarks(paragraphs(), range.current, m), `marks:${el.id}`)
  }

  const focus = () => {
    const n = root.current
    if (!n) return
    n.focus({ preventScroll: true })
    writeRange(n, range.current)
  }

  const link = (href: string | null) => {
    sync()
    const ps = paragraphs()
    let r = range.current
    if (isCollapsed(r)) {
      const around = linkRangeAt(ps, r.start)
      if (around) r = around
      else if (href) {
        // No words chosen: the address itself becomes the link text.
        const edit = insertText(ps, r, href, merge(marksAt(ps, r), { href }))
        range.current = { start: edit.caret, end: edit.caret }
        onCommit(edit.paragraphs, `link:${el.id}`)
        return
      } else return
    }
    range.current = r
    onCommit(applyMarks(ps, r, { href: href ?? undefined }), `link:${el.id}`)
  }

  const publish = () => {
    const ps = paragraphs()
    const r = range.current
    const own = pendingMarks()
    publishSession({
      id: el.id,
      range: r,
      marks: own ? merge(marksAt(ps, r), own) : marksAt(ps, r),
      mark: (m) => latest.current.mark(m),
      paragraphs: (fn) => {
        latest.current.sync()
        onCommit(fn(latest.current.paragraphs(), range.current), `para:${el.id}`)
      },
      link: (href) => latest.current.link(href),
      linkTarget() {
        const cur = latest.current.paragraphs()
        const around = isCollapsed(range.current) ? linkRangeAt(cur, range.current.start) : range.current
        return { href: marksAt(cur, around ?? range.current).href ?? null, empty: !around }
      },
      focus: () => latest.current.focus(),
      refresh() {
        latest.current.sync()
        latest.current.publish()
      },
    })
  }

  const commit = (edit: Edit, coalesce?: string) => {
    range.current = { start: edit.caret, end: edit.caret }
    pending.current = null
    if (edit.paragraphs !== paragraphs()) onCommit(edit.paragraphs, coalesce)
    else {
      if (root.current) writeRange(root.current, range.current)
      publish()
    }
  }

  /** Inserts typed or pasted text, with marks waiting at the caret if any. */
  const type = (text: string, at = range.current) => {
    const ps = paragraphs()
    const own = pendingMarks()
    commit(insertText(ps, at, text, own ? merge(marksAt(ps, { start: at.start, end: at.start }), own) : undefined))
  }

  const toggle = (k: 'bold' | 'italic' | 'underline') => {
    sync()
    const own = pendingMarks()
    const on = (own && k in own ? own[k] : marksAt(paragraphs(), range.current)[k]) === true
    mark({ [k]: on ? undefined : true })
  }

  const undo = (redo: boolean) => {
    const id = el.id
    if (redo) store.redo()
    else store.undo()
    const st = store.getState()
    const sl = st.deck.slides.find((x) => x.id === st.selection.slideId)
    if (sl && findElement(sl, id)) enterTextEditing(store, id, { mode: 'end' })
  }

  // Listeners and the published session call through this, so they always see the latest render.
  const latest = useRef({ publish, paragraphs, sync, mark, link, focus, type, commit, toggle, undo })
  latest.current = { publish, paragraphs, sync, mark, link, focus, type, commit, toggle, undo }

  // Focus and place the caret when editing starts. In development React runs
  // this twice; the entry (and a typed first character) is applied only once.
  const started = useRef(false)
  useLayoutEffect(() => {
    const n = root.current
    if (!n) return
    n.focus({ preventScroll: true })
    if (!started.current) {
      started.current = true
      const how = takeEntry(el.id)
      const all = allRange(el.paragraphs)
      if (how.mode === 'all') range.current = all
      else if (how.mode === 'point') {
        const p = caretFromPoint(n, how.x, how.y) ?? all.end
        range.current = { start: p, end: p }
      } else range.current = { start: all.end, end: all.end }
      writeRange(n, range.current)
      if (how.mode === 'type') type(how.text)
    } else writeRange(n, range.current)
    publish()
    return () => publishSession(null)
    // Runs once per editing session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After the text is redrawn, put the selection back.
  useLayoutEffect(() => {
    const n = root.current
    if (!n) return
    const active = document.activeElement
    if (active === n || active === document.body || active === null) writeRange(n, range.current)
    latest.current.publish()
  }, [el.paragraphs, rev])

  // Track the selection the user makes.
  useEffect(() => {
    const onChange = () => {
      const n = root.current
      if (!n || composing.current) return
      const r = readRange(n)
      if (!r || (samePos(r.start, range.current.start) && samePos(r.end, range.current.end))) return
      range.current = r
      latest.current.publish()
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [])

  // Model-driven input: the browser's own editing is cancelled.
  useEffect(() => {
    const n = root.current
    if (!n) return
    const { type, commit, toggle, undo, paragraphs } = latest.current
    const current = () => readRange(n) ?? range.current
    const onBeforeInput = (e: InputEvent) => {
      if (composing.current || e.inputType.includes('Composition')) return
      e.preventDefault()
      const r = current()
      const ps = paragraphs()
      switch (e.inputType) {
        case 'insertText':
        case 'insertReplacementText': {
          const text = e.data ?? e.dataTransfer?.getData('text/plain') ?? ''
          type(text, (e.inputType === 'insertReplacementText' && targetRange(n, e)) || r)
          break
        }
        case 'insertFromPaste': {
          const text = e.dataTransfer?.getData('text/plain') ?? ''
          if (text) type(text.slice(0, MAX_PASTE), r)
          break
        }
        case 'insertParagraph':
        case 'insertLineBreak': {
          const cleared = deleteRange(ps, r)
          commit(splitParagraph(cleared.paragraphs, cleared.caret))
          break
        }
        case 'deleteByDrag':
          // Dropping text is refused, so the drag must not delete it either.
          break
        case 'deleteByCut':
        case 'deleteContent':
          commit(deleteRange(ps, r))
          break
        default:
          if (e.inputType.startsWith('delete')) {
            const target = targetRange(n, e)
            if (target && !isCollapsed(target)) commit(deleteRange(ps, target))
            else if (!isCollapsed(r)) commit(deleteRange(ps, r))
            else {
              const other = step(ps, r.start, e.inputType.endsWith('Forward') ? 1 : -1)
              commit(deleteRange(ps, { start: r.start, end: other }))
            }
          } else if (e.inputType === 'historyUndo') undo(false)
          else if (e.inputType === 'historyRedo') undo(true)
          else if (e.inputType === 'formatBold') toggle('bold')
          else if (e.inputType === 'formatItalic') toggle('italic')
          else if (e.inputType === 'formatUnderline') toggle('underline')
      }
    }
    const onCompositionStart = () => {
      composing.current = current()
    }
    const onCompositionEnd = (e: CompositionEvent) => {
      const at = composing.current ?? range.current
      composing.current = null
      // The browser wrote the composed text into the DOM; drop its nodes and redraw from the model.
      for (const c of Array.from(n.childNodes)) if (!(c instanceof HTMLElement && c.dataset.flow !== undefined)) c.remove()
      setRev((v) => v + 1)
      if (e.data) type(e.data, at)
    }
    n.addEventListener('beforeinput', onBeforeInput)
    n.addEventListener('compositionstart', onCompositionStart)
    n.addEventListener('compositionend', onCompositionEnd)
    return () => {
      n.removeEventListener('beforeinput', onBeforeInput)
      n.removeEventListener('compositionstart', onCompositionStart)
      n.removeEventListener('compositionend', onCompositionEnd)
    }
  })

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onExit()
      return
    }
    const mod = isMac ? e.metaKey : e.ctrlKey
    if (!mod || e.altKey) return
    const k = e.key.toLowerCase()
    const run = (fn: () => void) => {
      e.preventDefault()
      e.stopPropagation()
      fn()
    }
    if (k === 'b' && !e.shiftKey) run(() => toggle('bold'))
    else if (k === 'i' && !e.shiftKey) run(() => toggle('italic'))
    else if (k === 'u' && !e.shiftKey) run(() => toggle('underline'))
    else if (k === 'k' && !e.shiftKey)
      run(() => {
        sync()
        publish()
        requestLinkEditor()
      })
    else if (k === 'z') run(() => undo(e.shiftKey))
    else if (k === 'y' && !e.shiftKey) run(() => undo(true))
  }

  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text || !root.current) return
    type(text.slice(0, MAX_PASTE), readRange(root.current) ?? range.current)
  }

  return (
    <div
      ref={root}
      className={`${slide.el} ${slide.text} ${s.editor}`}
      data-el-id={el.id}
      data-text-editor=""
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      aria-label="Text"
      spellCheck
      style={{ ...textBoxStyle(el, theme), ['--fit' as string]: String(fit) }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onDrop={(e) => e.preventDefault()}
    >
      <div key={rev} data-flow="">
        {renderParagraphs(el.paragraphs, t.weight)}
      </div>
    </div>
  )
}
