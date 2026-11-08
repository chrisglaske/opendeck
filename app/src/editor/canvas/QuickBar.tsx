import {
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  CopyPlus,
  Ellipsis,
  Group,
  Minus,
  MoveLeft,
  MoveRight,
  Square,
  SquareDashed,
  Ungroup,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { bounds, unionRect } from '../../model/geometry'
import { align, distribute, updateElements } from '../../model/ops'
import type { LineEl, ShapeEl, Slide, SlideElement } from '../../model/types'
import { Button, IconButton, NumberField } from '../../ui'
import { elementCommands, selectionInfo } from '../commands'
import { useEditor, useEditorStore } from '../EditorContext'
import { ALIGN_BUTTONS } from '../panel/ArrangeTab'
import { worldItems } from './world'
import s from './QuickBar.module.css'

/** Gap between the bar and the selection, in screen px. */
const GAP = 10
/** Below this much room above the selection, the bar goes underneath instead. */
const MIN_ROOM_ABOVE = 50
/** Keeps a bar placed underneath clear of the rotate handle. */
const BELOW_OFFSET = 36
const EDGE = 8

type Props = {
  frame: HTMLElement | null
  scale: number
  /** The canvas area the bar stays inside. */
  container: HTMLElement | null
  /** Hidden while a gesture is in progress. */
  hidden: boolean
  /** Opens the element menu at a screen point. */
  onMore(x: number, y: number): void
}

/**
 * A small floating bar of the most used settings for the selection, placed
 * above it (or below when there is no room) and kept inside the canvas.
 * Text, image and icon bars arrive with their editors.
 */
export function QuickBar({ frame, scale, container, hidden, onMore }: Props) {
  const slide = useEditor((st) => st.deck.slides.find((x) => x.id === st.selection.slideId) ?? st.deck.slides[0])
  const ids = useEditor((st) => st.selection.ids)
  const editingId = useEditor((st) => st.editingId)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [tick, setTick] = useState(0)

  const items = slide ? worldItems(slide, ids) : []
  const box = items.length ? unionRect(items.map((i) => bounds(i.el))) : null
  const single = items.length === 1 ? items[0].el : null
  const content = slide && box && !editingId ? barFor(slide, ids, single, items.length) : null

  // Follow the canvas when it scrolls or resizes.
  useLayoutEffect(() => {
    const scroller = container?.querySelector('[data-stage-scroller]')
    const bump = () => setTick((t) => t + 1)
    scroller?.addEventListener('scroll', bump, { passive: true })
    window.addEventListener('resize', bump)
    return () => {
      scroller?.removeEventListener('scroll', bump)
      window.removeEventListener('resize', bump)
    }
  }, [container])

  const key = box ? `${box.x},${box.y},${box.w},${box.h}` : ''
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar || !frame || !container || !box) return setPos(null)
    const f = frame.getBoundingClientRect(), c = container.getBoundingClientRect()
    const bw = bar.offsetWidth, bh = bar.offsetHeight
    const fx = f.left - c.left, fy = f.top - c.top
    let top = fy + box.y * scale - GAP - bh
    if (top < MIN_ROOM_ABOVE) top = fy + (box.y + box.h) * scale + BELOW_OFFSET
    const left = fx + box.x * scale
    setPos({
      left: Math.max(EDGE, Math.min(left, c.width - bw - EDGE)),
      top: Math.max(EDGE, Math.min(top, c.height - bh - EDGE)),
    })
  }, [key, scale, frame, container, tick, hidden, content === null, ids.join(',')])

  if (!content || hidden) return null
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={content.label}
      className={s.bar}
      data-quick-bar=""
      style={{ left: `${pos?.left ?? 0}px`, top: `${pos?.top ?? 0}px`, visibility: pos ? undefined : 'hidden' }}
    >
      {content.body}
      <IconButton
        icon={Ellipsis}
        label="More actions"
        size="sm"
        aria-haspopup="menu"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onMore(r.left, r.bottom + 4)
        }}
      />
    </div>
  )
}

function barFor(slide: Slide, ids: string[], single: SlideElement | null, count: number): { label: string; body: ReactNode } | null {
  if (count > 1) return { label: 'Selection options', body: <MultiBar slide={slide} ids={ids} count={count} /> }
  if (!single) return null
  if (single.type === 'shape') return { label: 'Shape options', body: <ShapeBar slideId={slide.id} el={single} /> }
  if (single.type === 'line') return { label: 'Line options', body: <LineBar slideId={slide.id} el={single} /> }
  if (single.type === 'group') return { label: 'Group options', body: <GroupBar /> }
  return null
}

function Sep() {
  return <span className={s.sep} aria-hidden />
}

function useUpdate<T extends SlideElement>(slideId: string, el: T) {
  const store = useEditorStore()
  return (field: string, fn: (e: T) => T) =>
    store.apply((d) => updateElements(d, slideId, [el.id], (e) => fn(e as T)), { coalesce: `${field}:${el.id}` })
}

function DuplicateButton() {
  const store = useEditorStore()
  return <IconButton icon={CopyPlus} label="Duplicate" size="sm" onClick={() => elementCommands(store).duplicate()} />
}

function ShapeBar({ slideId, el }: { slideId: string; el: ShapeEl }) {
  const update = useUpdate(slideId, el)
  return (
    <>
      <NumberField
        size="sm"
        className={s.field}
        label="Border width"
        prefix={<Square size={13} strokeWidth={2} />}
        min={0}
        max={200}
        value={el.stroke?.width ?? 0}
        onChange={(width) =>
          update('stroke', (e) => ({ ...e, stroke: width === 0 ? null : { color: { theme: 'text' }, dash: 'solid', ...e.stroke, width } }))
        }
      />
      {el.shape === 'rect' && (
        <NumberField
          size="sm"
          className={s.field}
          label="Corner radius"
          prefix={<SquareDashed size={13} strokeWidth={1.75} />}
          min={0}
          max={2000}
          value={Math.round(el.radius)}
          onChange={(radius) => update('radius', (e) => ({ ...e, radius }))}
        />
      )}
      <Sep />
      <DuplicateButton />
    </>
  )
}

function LineBar({ slideId, el }: { slideId: string; el: LineEl }) {
  const update = useUpdate(slideId, el)
  const dashed = el.stroke.dash === 'dashed'
  return (
    <>
      <NumberField
        size="sm"
        className={s.field}
        label="Line width"
        prefix={<Minus size={13} strokeWidth={2.5} />}
        min={1}
        max={200}
        value={el.stroke.width}
        onChange={(width) => update('stroke', (e) => ({ ...e, stroke: { ...e.stroke, width } }))}
      />
      <Button
        size="sm"
        variant="ghost"
        className={s.textButton}
        aria-label={dashed ? 'Dashed line, switch to solid' : 'Solid line, switch to dashed'}
        onClick={() => update('dash', (e) => ({ ...e, stroke: { ...e.stroke, dash: dashed ? 'solid' : 'dashed' } }))}
      >
        {dashed ? 'Dashed' : 'Solid'}
      </Button>
      <Sep />
      <IconButton
        icon={MoveLeft}
        label="Arrow at start"
        size="sm"
        pressed={el.start === 'arrow'}
        onClick={() => update('start', (e) => ({ ...e, start: e.start === 'arrow' ? 'none' : 'arrow' }))}
      />
      <IconButton
        icon={MoveRight}
        label="Arrow at end"
        size="sm"
        pressed={el.end === 'arrow'}
        onClick={() => update('end', (e) => ({ ...e, end: e.end === 'arrow' ? 'none' : 'arrow' }))}
      />
      <Sep />
      <DuplicateButton />
    </>
  )
}

function GroupBar() {
  const store = useEditorStore()
  return (
    <>
      <Button size="sm" variant="ghost" icon={Ungroup} className={s.textButton} onClick={() => elementCommands(store).ungroup()}>
        Ungroup
      </Button>
      <Sep />
      <DuplicateButton />
    </>
  )
}

function MultiBar({ slide, ids, count }: { slide: Slide; ids: string[]; count: number }) {
  const store = useEditorStore()
  const info = selectionInfo(slide, ids)
  const cmd = elementCommands(store)
  return (
    <>
      <span className={s.count}>{count} selected</span>
      <Sep />
      {ALIGN_BUTTONS.filter((b) => b.edge === 'left' || b.edge === 'hcenter' || b.edge === 'top' || b.edge === 'vcenter').map((b) => (
        <IconButton key={b.edge} icon={b.icon} label={b.label} size="sm" onClick={() => store.apply((d) => align(d, slide.id, ids, b.edge))} />
      ))}
      {count >= 3 && (
        <>
          <IconButton icon={AlignHorizontalSpaceAround} label="Distribute horizontally" size="sm" onClick={() => store.apply((d) => distribute(d, slide.id, ids, 'h'))} />
          <IconButton icon={AlignVerticalSpaceAround} label="Distribute vertically" size="sm" onClick={() => store.apply((d) => distribute(d, slide.id, ids, 'v'))} />
        </>
      )}
      {(info.canGroup || info.canUngroup) && <Sep />}
      {info.canGroup ? (
        <Button size="sm" variant="ghost" icon={Group} className={s.textButton} onClick={cmd.group}>
          Group
        </Button>
      ) : info.canUngroup ? (
        <Button size="sm" variant="ghost" icon={Ungroup} className={s.textButton} onClick={cmd.ungroup}>
          Ungroup
        </Button>
      ) : null}
    </>
  )
}
