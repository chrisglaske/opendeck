import { useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { bounds, moveElement, resizeBox, rotateAround, scaleInto, unionRect, MIN_SIZE } from '../../model/geometry'
import type { Handle, RotatedRect } from '../../model/geometry'
import { updateElements } from '../../model/ops'
import { snapMove, snapResize } from '../../model/snap'
import type { GapMark, Guide } from '../../model/snap'
import type { LineEl, Point, Rect, Slide, SlideElement } from '../../model/types'
import { useEditorStore } from '../EditorContext'
import { isMac } from '../shortcuts'
import type { EditorState } from '../store'
import { startCrop } from './cropSession'
import { enterTextEditing, exitTextEditing } from './textSession'
import { useDrag } from './useDrag'
import { snapTargets, worldItem, worldItems } from './world'
import type { WorldItem } from './world'

/** What the overlay draws for the gesture in progress. Positions are in slide units. */
export type Visuals = {
  guides: Guide[]
  gaps: GapMark[]
  /** A dark label under the box: position or size while dragging, angle while rotating. */
  readout: { text: string; x: number; y: number } | null
  marquee: Rect | null
}

export const NO_VISUALS: Visuals = { guides: [], gaps: [], readout: null, marquee: null }

/** A press that moves less than this (screen px) is a click. */
const DEAD_ZONE = 3
/** Snapping reaches this far, in screen px. */
const SNAP_PX = 6
const ROTATE_STEP = 15
const LINE_STEP = 45

const modKey = (e: { metaKey: boolean; ctrlKey: boolean }) => (isMac ? e.metaKey : e.ctrlKey)
const round = Math.round
const shifted = (r: Rect, dx: number, dy: number): Rect => ({ ...r, x: r.x + dx, y: r.y + dy })
const boxOf = (el: SlideElement): RotatedRect =>
  el.type === 'line' ? { ...bounds(el), rotation: 0 } : { x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation }
const centerOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
const intersects = (a: Rect, b: Rect) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
const angleDeg = (from: Point, to: Point) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
const normDeg = (d: number) => ((d % 360) + 360) % 360

export function slideOf(st: EditorState): Slide {
  return st.deck.slides.find((s) => s.id === st.selection.slideId) ?? st.deck.slides[0]
}

/** Writes changed world elements back to the deck, each in its own coordinates. */
export function writeBack(slideId: string, next: Map<string, SlideElement>) {
  return (d: EditorState['deck']) => updateElements(d, slideId, [...next.keys()], (el) => next.get(el.id) ?? el)
}

function selectionBox(items: WorldItem[]): Rect {
  return unionRect(items.map((i) => bounds(i.el)))
}

/** Which edges a handle drags, for snapping while resizing. */
function handleEdges(h: Handle): { x?: 'left' | 'right'; y?: 'top' | 'bottom' } {
  return {
    x: h[1] === 'l' ? 'left' : h[1] === 'r' ? 'right' : undefined,
    y: h[0] === 't' ? 'top' : h[0] === 'b' ? 'bottom' : undefined,
  }
}

/**
 * Pointer and keyboard editing on the canvas: select, marquee, move with
 * snapping, resize, rotate, line endpoints and nudging. Every gesture is one
 * `begin` → `preview`… → `commit` (or `cancel`), so it is one undo step.
 */
export function useCanvasGestures(frame: HTMLElement | null, scale: number, toSlidePoint: (x: number, y: number) => Point) {
  const store = useEditorStore()
  const startDrag = useDrag()
  const [visuals, setVisuals] = useState<Visuals>(NO_VISUALS)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const dragging = useRef(false)
  /** True while a gesture is changing the slide; quick bars hide meanwhile. */
  const [busy, setBusy] = useState(false)
  const markBusy = () => {
    dragging.current = true
    setBusy(true)
    setHoverId(null)
  }

  const finish = () => {
    dragging.current = false
    setBusy(false)
    setVisuals(NO_VISUALS)
  }

  /** Element ids under a point, outermost first (a group, then its child…). */
  const chainAt = (clientX: number, clientY: number): string[] => {
    const hit = document.elementFromPoint?.(clientX, clientY)
    if (!frame || !hit || !frame.contains(hit)) return []
    const chain: string[] = []
    let n = hit.closest<HTMLElement>('[data-el-id]')
    while (n && frame.contains(n)) {
      chain.unshift(n.dataset.elId!)
      n = n.parentElement?.closest<HTMLElement>('[data-el-id]') ?? null
    }
    return chain
  }

  /** The element a click picks: top level, or a sibling when the selection is inside a group. */
  const pick = (chain: string[], slide: Slide, ids: string[]): string | null => {
    if (chain.length === 0) return null
    const entered = ids.length ? worldItem(slide, ids[0])?.parentId : null
    const k = entered ? chain.indexOf(entered) : -1
    return k >= 0 && chain[k + 1] ? chain[k + 1] : chain[0]
  }

  const blurFocus = () => {
    const a = document.activeElement
    if (a instanceof HTMLElement && a !== document.body) a.blur()
  }

  // ── move ──
  const startMove = (e: ReactPointerEvent, ids: string[], clickTarget: string | null) => {
    const st = store.getState()
    const slide = slideOf(st)
    const items = worldItems(slide, ids).filter((i) => !i.locked)
    const box0 = items.length ? selectionBox(items) : null
    const others = snapTargets(slide, ids)
    const p0 = toSlidePoint(e.clientX, e.clientY)
    const c0 = { x: e.clientX, y: e.clientY }
    let began = false
    startDrag(e, {
      move(ev) {
        if (!began) {
          if (!box0 || Math.hypot(ev.clientX - c0.x, ev.clientY - c0.y) < DEAD_ZONE) return
          store.begin()
          began = true
          markBusy()
        }
        const p = toSlidePoint(ev.clientX, ev.clientY)
        let dx = round(p.x - p0.x), dy = round(p.y - p0.y)
        let guides: Guide[] = [], gaps: GapMark[] = []
        if (!modKey(ev)) {
          const s = snapMove(shifted(box0!, dx, dy), others, SNAP_PX / scale)
          dx += s.dx
          dy += s.dy
          guides = s.guides
          gaps = s.gaps
        }
        store.preview(writeBack(slide.id, new Map(items.map((i) => [i.id, i.toLocal(moveElement(i.el, dx, dy))]))))
        const b = shifted(box0!, dx, dy)
        setVisuals({ guides, gaps, marquee: null, readout: { text: `X ${round(b.x)} · Y ${round(b.y)}`, x: b.x, y: b.y + b.h } })
      },
      end() {
        if (began) store.commit()
        else if (clickTarget && ids.length > 1) store.select({ slideId: slide.id, ids: [clickTarget] })
        finish()
      },
      cancel() {
        if (began) store.cancel()
        finish()
      },
    })
  }

  // ── marquee ──
  const startMarquee = (e: ReactPointerEvent, base: string[]) => {
    const st = store.getState()
    const slide = slideOf(st)
    store.select({ slideId: slide.id, ids: base })
    const p0 = toSlidePoint(e.clientX, e.clientY)
    const c0 = { x: e.clientX, y: e.clientY }
    let active = false
    startDrag(e, {
      move(ev) {
        if (!active && Math.hypot(ev.clientX - c0.x, ev.clientY - c0.y) < DEAD_ZONE) return
        if (!active) markBusy()
        active = true
        const p = toSlidePoint(ev.clientX, ev.clientY)
        const r = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) }
        const hit = slide.elements.filter((el) => !el.locked && !base.includes(el.id) && intersects(bounds(el), r)).map((el) => el.id)
        store.select({ slideId: slide.id, ids: [...base, ...hit] })
        setVisuals({ ...NO_VISUALS, marquee: r })
      },
      end: finish,
      cancel() {
        store.select({ slideId: slide.id, ids: base })
        finish()
      },
    })
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    // Clicks in the text being edited place the caret.
    if ((e.target as Element).closest?.('[data-text-editor]')) return
    if (store.getState().editingId) exitTextEditing(store)
    const st = store.getState()
    e.preventDefault() // no text selection or native image drag
    blurFocus()
    const slide = slideOf(st)
    const ids = st.selection.ids
    const target = pick(chainAt(e.clientX, e.clientY), slide, ids)
    if (!target) {
      const p = toSlidePoint(e.clientX, e.clientY)
      const box = ids.length > 1 ? selectionBox(worldItems(slide, ids)) : null
      if (box && intersects(box, { ...p, w: 0, h: 0 }) && !e.shiftKey) return startMove(e, ids, null)
      return startMarquee(e, e.shiftKey ? ids : [])
    }
    if (e.shiftKey) {
      const next = ids.includes(target) ? ids.filter((id) => id !== target) : [...ids, target]
      store.select({ slideId: slide.id, ids: next })
      return
    }
    if (ids.includes(target)) return startMove(e, ids, target)
    store.select({ slideId: slide.id, ids: [target] })
    startMove(e, [target], null)
  }

  const onDoubleClick = (e: ReactMouseEvent) => {
    if ((e.target as Element).closest?.('[data-text-editor]')) return
    const st = store.getState()
    const slide = slideOf(st)
    const chain = chainAt(e.clientX, e.clientY)
    const target = pick(chain, slide, st.selection.ids)
    if (!target) return
    const inner = chain[chain.indexOf(target) + 1]
    const kind = worldItem(slide, target)?.el.type
    if (inner && kind === 'group') store.select({ slideId: slide.id, ids: [inner] })
    else if (kind === 'text') enterTextEditing(store, target, { mode: 'point', x: e.clientX, y: e.clientY })
    else if (kind === 'image') startCrop(store, target)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (dragging.current || e.buttons) return
    const st = store.getState()
    setHoverId(pick(chainAt(e.clientX, e.clientY), slideOf(st), st.selection.ids))
  }

  const onPointerLeave = () => setHoverId(null)

  /** The selection, ready for a handle drag; null when nothing can be transformed. */
  const handleTargets = () => {
    const st = store.getState()
    const slide = slideOf(st)
    const items = worldItems(slide, st.selection.ids)
    if (items.length === 0 || items.some((i) => i.locked)) return null
    return { slide, items }
  }

  const beginHandle = (e: ReactPointerEvent) => {
    if (e.button !== 0) return false
    e.preventDefault()
    e.stopPropagation()
    blurFocus()
    return true
  }

  // ── resize ──
  const startResize = (e: ReactPointerEvent, handle: Handle) => {
    if (!beginHandle(e)) return
    const t = handleTargets()
    if (!t) return
    const { slide, items } = t
    const single = items.length === 1 ? items[0] : null
    const start: RotatedRect = single ? boxOf(single.el) : { ...selectionBox(items), rotation: 0 }
    const corner = handle[0] !== 'm' && handle[1] !== 'm'
    // Images and icons keep their proportions from a corner unless Shift frees them.
    const aspectByDefault = corner && single !== null && (single.el.type === 'image' || single.el.type === 'icon')
    const others = snapTargets(slide, items.map((i) => i.id))
    let began = false
    startDrag(e, {
      move(ev) {
        if (!began) {
          store.begin()
          began = true
          markBusy()
        }
        const p = toSlidePoint(ev.clientX, ev.clientY)
        const keepAspect = aspectByDefault ? !ev.shiftKey : ev.shiftKey
        let r: Rect = resizeBox(start, handle, p, { keepAspect, fromCenter: ev.altKey })
        let guides: Guide[] = []
        if (start.rotation % 360 === 0 && !keepAspect && !ev.altKey && !modKey(ev)) {
          const s = snapResize(r, handleEdges(handle), others, SNAP_PX / scale)
          if (s.rect.w >= MIN_SIZE && s.rect.h >= MIN_SIZE) {
            r = s.rect
            guides = s.guides
          }
        }
        const to = { x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) }
        const from = single ? boxOf(single.el) : start
        store.preview(writeBack(slide.id, new Map(items.map((i) => [i.id, i.toLocal(scaleInto(i.el, from, to))]))))
        const b = single ? bounds(scaleInto(single.el, from, to)) : to
        setVisuals({ guides, gaps: [], marquee: null, readout: { text: `W ${to.w} · H ${to.h}`, x: b.x, y: b.y + b.h } })
      },
      end() {
        if (began) store.commit()
        finish()
      },
      cancel() {
        if (began) store.cancel()
        finish()
      },
    })
  }

  // ── rotate ──
  const startRotate = (e: ReactPointerEvent) => {
    if (!beginHandle(e)) return
    const t = handleTargets()
    if (!t) return
    const { slide, items } = t
    const single = items.length === 1 && items[0].el.type !== 'line' ? items[0] : null
    const center = centerOf(single ? boxOf(single.el) : selectionBox(items))
    const a0 = angleDeg(center, toSlidePoint(e.clientX, e.clientY))
    let began = false
    startDrag(e, {
      move(ev) {
        if (!began) {
          store.begin()
          began = true
          markBusy()
        }
        let delta = angleDeg(center, toSlidePoint(ev.clientX, ev.clientY)) - a0
        let label: number
        let next: Map<string, SlideElement>
        if (single && single.el.type !== 'line') {
          let deg = single.el.rotation + delta
          deg = normDeg(ev.shiftKey ? round(deg / ROTATE_STEP) * ROTATE_STEP : round(deg))
          label = deg
          next = new Map([[single.id, single.toLocal({ ...single.el, rotation: deg })]])
        } else {
          delta = ev.shiftKey ? round(delta / ROTATE_STEP) * ROTATE_STEP : round(delta)
          label = normDeg(delta)
          next = new Map(items.map((i) => [i.id, i.toLocal(rotateAround(i.el, center, delta))]))
        }
        store.preview(writeBack(slide.id, next))
        const b = unionRect([...next.keys()].map((id) => bounds(worldItem(slideOf(store.getState()), id)!.el)))
        setVisuals({ ...NO_VISUALS, readout: { text: `${label}°`, x: b.x, y: b.y + b.h } })
      },
      end() {
        if (began) store.commit()
        finish()
      },
      cancel() {
        if (began) store.cancel()
        finish()
      },
    })
  }

  // ── line endpoints ──
  const startEndpoint = (e: ReactPointerEvent, end: 1 | 2) => {
    if (!beginHandle(e)) return
    const t = handleTargets()
    if (!t || t.items.length !== 1 || t.items[0].el.type !== 'line') return
    const { slide } = t
    const item = t.items[0]
    const line = item.el as LineEl
    const fixed = end === 1 ? { x: line.x2, y: line.y2 } : { x: line.x1, y: line.y1 }
    let began = false
    startDrag(e, {
      move(ev) {
        if (!began) {
          store.begin()
          began = true
          markBusy()
        }
        let q = toSlidePoint(ev.clientX, ev.clientY)
        if (ev.shiftKey) {
          const len = Math.hypot(q.x - fixed.x, q.y - fixed.y)
          const a = (round(angleDeg(fixed, q) / LINE_STEP) * LINE_STEP * Math.PI) / 180
          q = { x: fixed.x + len * Math.cos(a), y: fixed.y + len * Math.sin(a) }
        }
        q = { x: round(q.x), y: round(q.y) }
        const next: LineEl = end === 1 ? { ...line, x1: q.x, y1: q.y } : { ...line, x2: q.x, y2: q.y }
        store.preview(writeBack(slide.id, new Map([[item.id, item.toLocal(next)]])))
        const b = bounds(next)
        setVisuals({ ...NO_VISUALS, readout: { text: `W ${round(b.w)} · H ${round(b.h)}`, x: b.x, y: b.y + b.h } })
      },
      end() {
        if (began) store.commit()
        finish()
      },
      cancel() {
        if (began) store.cancel()
        finish()
      },
    })
  }

  return {
    visuals,
    hoverId,
    busy,
    /** Picks the element a pointer event is on, selecting it the way a click would; null on empty canvas. */
    selectAt(clientX: number, clientY: number): string | null {
      const st = store.getState()
      const slide = slideOf(st)
      const target = pick(chainAt(clientX, clientY), slide, st.selection.ids)
      if (target && !st.selection.ids.includes(target)) store.select({ slideId: slide.id, ids: [target] })
      return target
    },
    canvasHandlers: { onPointerDown, onPointerMove, onPointerLeave, onDoubleClick },
    startResize,
    startRotate,
    startEndpoint,
  }
}
