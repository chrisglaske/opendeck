import { Lock } from 'lucide-react'
import { useMemo } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { bounds, unionRect } from '../../model/geometry'
import type { Handle } from '../../model/geometry'
import type { LineEl, SlideElement } from '../../model/types'
import { useEditor } from '../EditorContext'
import { useCropId } from './cropSession'
import type { Visuals } from './useCanvasGestures'
import { worldItem, worldItems } from './world'
import s from './Overlay.module.css'

const HANDLES: Handle[] = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br']

type Props = {
  scale: number
  hoverId: string | null
  visuals: Visuals
  onResize(e: ReactPointerEvent, h: Handle): void
  onRotate(e: ReactPointerEvent): void
  onEndpoint(e: ReactPointerEvent, end: 1 | 2): void
}

/**
 * Editing marks drawn over the slide: hover and selection outlines, handles,
 * snap guides, spacing marks, the readout and the marquee. Everything is
 * sized in screen pixels; only positions follow the slide's scale.
 */
export function Overlay({ scale, hoverId, visuals, onResize, onRotate, onEndpoint }: Props) {
  const slide = useEditor((st) => st.deck.slides.find((x) => x.id === st.selection.slideId) ?? st.deck.slides[0])
  const ids = useEditor((st) => st.selection.ids)
  const editingId = useEditor((st) => st.editingId)
  const cropping = useCropId() !== null
  // Crop mode draws its own frame and handles.
  const items = useMemo(() => (slide && !cropping ? worldItems(slide, ids) : []), [slide, ids, cropping])
  const hover = slide && hoverId && !ids.includes(hoverId) ? worldItem(slide, hoverId) : null
  const px = (n: number) => `${n * scale}px`

  const locked = items.some((i) => i.locked)
  const editing = items.length === 1 && items[0].id === editingId
  const single = items.length === 1 ? items[0] : null
  const showHandles = !locked && !editing

  return (
    <div className={s.overlay} aria-hidden="true">
      {hover && (
        <Outline el={hover.el} scale={scale} className={s.hover} kind="hover">
          {hover.locked && <LockBadge />}
        </Outline>
      )}

      {items.length > 1 && items.map((i) => <Outline key={i.id} el={i.el} scale={scale} className={s.member} kind="member" />)}

      {single && single.el.type === 'line' && (
        <>
          <Outline el={single.el} scale={scale} className={s.selected} kind="selected" />
          {showHandles &&
            ([1, 2] as const).map((end) => {
              const l = single.el as LineEl
              return (
                <div
                  key={end}
                  className={s.endpoint}
                  data-handle={`p${end}`}
                  style={{ left: px(end === 1 ? l.x1 : l.x2), top: px(end === 1 ? l.y1 : l.y2) }}
                  onPointerDown={(e) => onEndpoint(e, end)}
                />
              )
            })}
          {locked && <LockBadgeAt rect={bounds(single.el)} scale={scale} />}
        </>
      )}

      {items.length > 0 && !(single && single.el.type === 'line') && (
        <SelectionBox
          box={single && single.el.type !== 'line' ? single.el : { ...unionRect(items.map((i) => bounds(i.el))), rotation: 0 }}
          scale={scale}
          className={`${s.selected} ${single?.el.type === 'group' ? s.group : ''} ${editing ? s.editing : ''}`}
        >
          {showHandles &&
            HANDLES.map((h) => <div key={h} className={s.handle} data-handle={h} onPointerDown={(e) => onResize(e, h)} />)}
          {showHandles && <div className={s.rotate} data-handle="rotate" onPointerDown={onRotate} />}
          {locked && <LockBadge />}
        </SelectionBox>
      )}

      {visuals.guides.map((g, i) => (
        <div
          key={`g${i}`}
          className={g.axis === 'x' ? s.guideV : s.guideH}
          data-guide={g.axis}
          style={
            g.axis === 'x'
              ? { left: px(g.at), top: px(g.from), height: px(g.to - g.from) }
              : { top: px(g.at), left: px(g.from), width: px(g.to - g.from) }
          }
        />
      ))}
      {visuals.gaps.map((g, i) => (
        <div
          key={`m${i}`}
          className={g.axis === 'x' ? s.gapH : s.gapV}
          data-gap={g.axis}
          style={
            g.axis === 'x'
              ? { left: px(g.from), top: px(g.at), width: px(g.to - g.from) }
              : { top: px(g.from), left: px(g.at), height: px(g.to - g.from) }
          }
        >
          <span className={s.gapLabel}>{Math.round(g.size)}</span>
        </div>
      ))}
      {visuals.marquee && (
        <div
          className={s.marquee}
          data-marquee=""
          style={{ left: px(visuals.marquee.x), top: px(visuals.marquee.y), width: px(visuals.marquee.w), height: px(visuals.marquee.h) }}
        />
      )}
      {visuals.readout && (
        <div className={s.readout} data-readout="" style={{ left: px(visuals.readout.x), top: px(visuals.readout.y) }}>
          {visuals.readout.text}
        </div>
      )}
    </div>
  )
}

type Box = { x: number; y: number; w: number; h: number; rotation: number }

function boxStyle(b: Box, scale: number): CSSProperties {
  return {
    left: `${b.x * scale}px`,
    top: `${b.y * scale}px`,
    width: `${b.w * scale}px`,
    height: `${b.h * scale}px`,
    transform: b.rotation % 360 ? `rotate(${b.rotation}deg)` : undefined,
  }
}

function SelectionBox({ box, scale, className, children }: { box: Box; scale: number; className: string; children?: ReactNode }) {
  return (
    <div className={`${s.box} ${className}`} data-selection-box="" style={boxStyle(box, scale)}>
      {children}
    </div>
  )
}

/** The element's outline: its (rotated) box, or a stroke along a line. */
function Outline({ el, scale, className, kind, children }: { el: SlideElement; scale: number; className: string; kind: string; children?: ReactNode }) {
  if (el.type === 'line') {
    const len = Math.hypot(el.x2 - el.x1, el.y2 - el.y1)
    const deg = (Math.atan2(el.y2 - el.y1, el.x2 - el.x1) * 180) / Math.PI
    return (
      <div
        className={`${s.lineOutline} ${className}`}
        data-outline={kind}
        style={{ left: `${el.x1 * scale}px`, top: `${el.y1 * scale}px`, width: `${len * scale}px`, transform: `rotate(${deg}deg)` }}
      >
        {children}
      </div>
    )
  }
  return (
    <div className={`${s.box} ${className}`} data-outline={kind} style={boxStyle(el, scale)}>
      {children}
    </div>
  )
}

function LockBadge() {
  return (
    <span className={s.lock} data-lock-badge="">
      <Lock size={11} strokeWidth={2} />
    </span>
  )
}

function LockBadgeAt({ rect, scale }: { rect: { x: number; y: number; w: number; h: number }; scale: number }) {
  return (
    <div className={s.box} style={boxStyle({ ...rect, rotation: 0 }, scale)}>
      <LockBadge />
    </div>
  )
}
