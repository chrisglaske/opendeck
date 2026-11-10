import { GripVertical, Lock, LockOpen } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { moveLayer, reorder, updateElements } from '../../model/ops'
import type { Slide, SlideElement } from '../../model/types'
import { useDrag } from '../canvas/useDrag'
import { useEditorStore } from '../EditorContext'
import { elementTitle } from './elementTitle'
import styles from './Panel.module.css'

const TEXT_LABEL_CHARS = 24

/** A short name for a layer row: the start of a text box's words, or the element type. */
export function layerLabel(el: SlideElement): string {
  if (el.type === 'text') {
    const text = el.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(' ').trim()
    if (text) return text.length > TEXT_LABEL_CHARS ? `${text.slice(0, TEXT_LABEL_CHARS).trimEnd()}…` : text
  }
  return elementTitle(el).label
}

type Drag = { id: string; from: number; drop: number; active: boolean }

/** Top-level layers, topmost first. Click selects, Shift adds; drag the grip (or Alt+↑/↓) to reorder. */
export function LayerList({ slide, ids }: { slide: Slide; ids: string[] }) {
  const store = useEditorStore()
  const startDrag = useDrag()
  const rows = useRef(new Map<string, HTMLLIElement>())
  const [drag, setDrag] = useState<Drag | null>(null)
  const layers = slide.elements.slice().reverse()

  const select = (e: MouseEvent, id: string) => {
    const next = e.shiftKey ? (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]) : [id]
    store.select({ slideId: slide.id, ids: next })
  }

  const toggleLock = (el: SlideElement) =>
    store.apply((d) => updateElements(d, slide.id, [el.id], (e) => ({ ...e, locked: !e.locked })))

  const onKeyDown = (e: KeyboardEvent, id: string) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    store.apply((d) => reorder(d, slide.id, [id], e.key === 'ArrowUp' ? 'forward' : 'backward'))
  }

  /** Display index a pointer at `y` would drop at, counted before the dragged row is removed. */
  const dropAt = (y: number) =>
    layers.filter((el) => {
      const r = rows.current.get(el.id)?.getBoundingClientRect()
      return r ? r.top + r.height / 2 < y : false
    }).length

  const onGripDown = (e: ReactPointerEvent, id: string, from: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    const y0 = e.clientY
    let state: Drag = { id, from, drop: from, active: false }
    startDrag(e, {
      move(ev) {
        if (!state.active && Math.abs(ev.clientY - y0) < 3) return
        state = { ...state, active: true, drop: dropAt(ev.clientY) }
        setDrag(state)
      },
      end() {
        setDrag(null)
        if (!state.active) return
        const d = state.drop > state.from ? state.drop - 1 : state.drop
        // Rows run top-first; the element list runs bottom-first.
        const toIndex = layers.length - 1 - d
        store.apply((deck) => moveLayer(deck, slide.id, id, toIndex))
      },
      cancel() {
        setDrag(null)
      },
    })
  }

  return (
    <ul className={styles.layers} aria-label="Layers">
      {layers.map((el, i) => {
        const { icon: Icon } = elementTitle(el)
        const label = layerLabel(el)
        const selected = ids.includes(el.id)
        const showDrop = drag?.active && drag.drop === i && drag.drop !== drag.from && drag.drop !== drag.from + 1
        return (
          <li
            key={el.id}
            ref={(n) => {
              if (n) rows.current.set(el.id, n)
              else rows.current.delete(el.id)
            }}
            className={styles.layer}
            data-layer-id={el.id}
            data-selected={selected || undefined}
            data-dragging={drag?.active && drag.id === el.id ? '' : undefined}
          >
            {showDrop && <span className={styles.layerDrop} data-drop-line="" />}
            <button type="button" className={styles.layerName} aria-pressed={selected} onClick={(e) => select(e, el.id)} onKeyDown={(e) => onKeyDown(e, el.id)}>
              <Icon size={14} strokeWidth={1.75} aria-hidden />
              <span>{label}</span>
            </button>
            <button
              type="button"
              className={styles.layerLock}
              data-locked={el.locked || undefined}
              aria-label={`${el.locked ? 'Unlock' : 'Lock'} ${label}`}
              onClick={() => toggleLock(el)}
            >
              {el.locked ? <Lock size={13} strokeWidth={1.75} aria-hidden /> : <LockOpen size={13} strokeWidth={1.75} aria-hidden />}
            </button>
            <span className={styles.grip} data-grip="" aria-hidden onPointerDown={(e) => onGripDown(e, el.id, i)}>
              <GripVertical size={14} strokeWidth={1.75} />
            </span>
          </li>
        )
      })}
      {drag?.active && drag.drop === layers.length && drag.from !== layers.length - 1 && (
        <li className={styles.layerEnd} aria-hidden>
          <span className={styles.layerDrop} data-drop-line="" />
        </li>
      )}
    </ul>
  )
}
