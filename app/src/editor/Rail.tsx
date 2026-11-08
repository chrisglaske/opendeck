import { CopyPlus, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { addSlide, deleteSlides, duplicateSlides, moveSlides, updateSlide } from '../model/ops'
import type { Theme } from '../model/theme'
import { SLIDE_W } from '../model/types'
import type { Deck, Slide } from '../model/types'
import { SlideView } from '../render/SlideView'
import { Button, ContextMenu } from '../ui'
import type { MenuItem } from '../ui'
import { useEditor, useEditorStore } from './EditorContext'
import { isMac, shortcutLabel } from './shortcuts'
import styles from './Rail.module.css'

/** Thumbnail width in screen pixels. */
export const THUMB_W = 128
const THUMB_SCALE = THUMB_W / SLIDE_W
/** Pointer travel before a press becomes a drag. */
const DRAG_THRESHOLD = 4

type Drag = { ids: string[]; startY: number; x: number; y: number; active: boolean; drop: number }
type Menu = { x: number; y: number; ids: string[]; returnTo: HTMLElement | null }

const ordered = (deck: Deck, ids: string[]) => deck.slides.filter((s) => ids.includes(s.id)).map((s) => s.id)

export function Rail() {
  const store = useEditorStore()
  const slides = useEditor((s) => s.deck.slides)
  const theme = useEditor((s) => s.deck.theme)
  const current = useEditor((s) => s.selection.slideId)
  const [picked, setPicked] = useState<string[]>([current])
  const anchor = useRef(current)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const thumbRefs = useRef(new Map<string, HTMLDivElement>())
  const justDragged = useRef(false)

  // The rail selection always includes the current slide and only slides that still exist.
  const live = picked.filter((id) => slides.some((s) => s.id === id))
  const selected = live.includes(current) ? live : [current]
  useEffect(() => {
    if (selected !== live || live.length !== picked.length) setPicked(selected)
  })

  const goTo = (id: string, keep: string[] = [id]) => {
    setPicked(keep)
    const { selection } = store.getState()
    if (selection.slideId !== id || selection.ids.length) store.select({ slideId: id, ids: [] })
  }

  const focusThumb = (id: string) => requestAnimationFrame(() => thumbRefs.current.get(id)?.focus())

  const onClick = (e: MouseEvent, slide: Slide) => {
    if (justDragged.current) { justDragged.current = false; return }
    const ids = slides.map((s) => s.id)
    if (e.shiftKey) {
      const a = ids.indexOf(anchor.current), b = ids.indexOf(slide.id)
      const [lo, hi] = a < 0 ? [b, b] : [Math.min(a, b), Math.max(a, b)]
      goTo(slide.id, ids.slice(lo, hi + 1))
      return
    }
    anchor.current = slide.id
    if (isMac ? e.metaKey : e.ctrlKey) {
      if (selected.includes(slide.id) && selected.length > 1) {
        const rest = selected.filter((id) => id !== slide.id)
        goTo(slide.id === current ? rest[0] : current, rest)
      } else {
        goTo(slide.id, [...selected.filter((id) => id !== slide.id), slide.id])
      }
      return
    }
    goTo(slide.id)
  }

  // ── commands on the rail selection ──
  const duplicate = (ids: string[]) => {
    const r = duplicateSlides(store.getState().deck, ids)
    if (!r.slideIds.length) return
    store.apply(() => r.deck, { selection: { slideId: r.slideIds[0], ids: [] } })
    setPicked(r.slideIds)
    focusThumb(r.slideIds[0])
  }
  const remove = (ids: string[]) => {
    const r = deleteSlides(store.getState().deck, ids)
    store.apply(() => r.deck, { selection: { slideId: r.nextSlideId, ids: [] } })
    setPicked([r.nextSlideId])
    focusThumb(r.nextSlideId)
  }
  const setHidden = (ids: string[], hidden: boolean) => {
    store.apply((d) => ids.reduce((acc, id) => updateSlide(acc, id, { hidden }), d))
  }
  const move = (ids: string[], dir: 1 | -1) => {
    const d = store.getState().deck
    const idx = ordered(d, ids).map((id) => d.slides.findIndex((s) => s.id === id))
    const to = dir === -1 ? Math.min(...idx) - 1 : Math.max(...idx) + 2
    if (to < 0 || to > d.slides.length) return
    store.apply((x) => moveSlides(x, ids, to))
    focusThumb(current)
  }
  const add = () => {
    const r = addSlide(store.getState().deck, current)
    store.apply(() => r.deck, { selection: { slideId: r.slideId, ids: [] } })
    setPicked([r.slideId])
    anchor.current = r.slideId
  }

  const openMenu = (slide: Slide, x: number, y: number, returnTo: HTMLElement | null) => {
    const ids = selected.includes(slide.id) ? ordered(store.getState().deck, selected) : [slide.id]
    if (!selected.includes(slide.id)) goTo(slide.id)
    setMenu({ x, y, ids, returnTo })
  }

  const menuItems = (ids: string[]): MenuItem[] => {
    const n = ids.length
    const allHidden = ids.every((id) => slides.find((s) => s.id === id)?.hidden)
    const many = (one: string, several: string) => (n > 1 ? several.replace('#', String(n)) : one)
    return [
      { id: 'dup', label: many('Duplicate', 'Duplicate # slides'), icon: CopyPlus, shortcut: shortcutLabel('mod+d'), onSelect: () => duplicate(ids) },
      allHidden
        ? { id: 'show', label: many('Show slide', 'Show # slides'), icon: Eye, onSelect: () => setHidden(ids, false) }
        : { id: 'hide', label: many('Hide slide', 'Hide # slides'), icon: EyeOff, onSelect: () => setHidden(ids, true) },
      'separator',
      { id: 'delete', label: many('Delete', 'Delete # slides'), icon: Trash2, shortcut: '⌫', danger: true, onSelect: () => remove(ids) },
    ]
  }

  const onKeyDown = (e: KeyboardEvent, slide: Slide, index: number) => {
    const ids = selected.includes(slide.id) ? selected : [slide.id]
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      move(ids, e.key === 'ArrowUp' ? -1 : 1)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = slides[index + (e.key === 'ArrowUp' ? -1 : 1)]
      if (next) { goTo(next.id); anchor.current = next.id; thumbRefs.current.get(next.id)?.focus() }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(ids)
    } else if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      duplicate(ids)
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      const r = e.currentTarget.getBoundingClientRect()
      openMenu(slide, r.left + 24, r.top + r.height / 2, e.currentTarget as HTMLElement)
    }
  }

  // ── drag to reorder ──
  const dropIndexAt = (y: number) =>
    slides.filter((s) => {
      const r = thumbRefs.current.get(s.id)?.getBoundingClientRect()
      return r ? r.top + r.height / 2 < y : false
    }).length

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, slide: Slide) => {
    if (e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey) return
    const ids = selected.includes(slide.id) ? ordered(store.getState().deck, selected) : [slide.id]
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ ids, startY: e.clientY, x: e.clientX, y: e.clientY, active: false, drop: -1 })
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag) return
    const active = drag.active || Math.abs(e.clientY - drag.startY) > DRAG_THRESHOLD
    setDrag({ ...drag, active, x: e.clientX, y: e.clientY, drop: active ? dropIndexAt(e.clientY) : -1 })
  }
  const onPointerUp = () => {
    if (!drag) return
    if (drag.active) {
      justDragged.current = true
      if (!drag.ids.includes(current)) goTo(drag.ids[0], drag.ids)
      store.apply((d) => moveSlides(d, drag.ids, drag.drop))
      // The click that follows a drag is ignored; clear the flag if no click comes.
      setTimeout(() => { justDragged.current = false }, 0)
    }
    setDrag(null)
  }

  const dragging = drag?.active ? drag : null
  const ghost = dragging ? slides.find((s) => s.id === dragging.ids[0]) : undefined

  return (
    <aside className={styles.rail} aria-label="Slide list">
      <div
        role="listbox"
        aria-label="Slides"
        aria-multiselectable="true"
        aria-orientation="vertical"
        className={styles.list}
      >
        {slides.map((slide, i) => (
          <div key={slide.id} className={styles.item}>
            {dragging && dragging.drop === i && <div className={styles.dropLine} data-drop-line="" aria-hidden />}
            <div
              ref={(el) => {
                if (el) thumbRefs.current.set(slide.id, el)
                else thumbRefs.current.delete(slide.id)
              }}
              role="option"
              aria-selected={selected.includes(slide.id)}
              aria-current={slide.id === current ? 'true' : undefined}
              aria-label={`Slide ${i + 1}${slide.hidden ? ', hidden' : ''}`}
              tabIndex={slide.id === current ? 0 : -1}
              data-slide-id={slide.id}
              data-hidden={slide.hidden ? '' : undefined}
              data-dragging={dragging?.ids.includes(slide.id) ? '' : undefined}
              className={`${styles.thumb} ${slide.id === current ? styles.current : ''}`}
              onClick={(e) => onClick(e, slide)}
              onKeyDown={(e) => onKeyDown(e, slide, i)}
              onContextMenu={(e) => {
                e.preventDefault()
                openMenu(slide, e.clientX, e.clientY, e.currentTarget)
              }}
              onPointerDown={(e) => onPointerDown(e, slide)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
            >
              <span className={styles.num} aria-hidden>{i + 1}</span>
              <Thumb slide={slide} theme={theme} />
            </div>
          </div>
        ))}
        {dragging && dragging.drop === slides.length && <div className={styles.dropLine} data-drop-line="" aria-hidden />}
      </div>
      <Button variant="secondary" size="sm" icon={Plus} className={styles.add} onClick={add}>
        Add slide
      </Button>
      {ghost && dragging && (
        <div className={styles.ghost} style={{ left: `${dragging.x + 12}px`, top: `${dragging.y - 20}px` }} aria-hidden>
          <Thumb slide={ghost} theme={theme} />
        </div>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label="Slide actions"
          caption={menu.ids.length > 1 ? `${menu.ids.length} slides selected` : undefined}
          items={menuItems(menu.ids)}
          onClose={() => {
            const back = menu.returnTo
            setMenu(null)
            if (back?.isConnected) back.focus()
          }}
        />
      )}
    </aside>
  )
}

function Thumb({ slide, theme }: { slide: Slide; theme: Theme }) {
  return (
    <div className={styles.mini}>
      <div className={styles.miniSlide}>
        <SlideView slide={slide} theme={theme} scale={THUMB_SCALE} interactive={false} />
      </div>
      {slide.hidden && (
        <span className={styles.eyeOff}>
          <EyeOff size={12} strokeWidth={1.75} aria-hidden />
        </span>
      )}
    </div>
  )
}
