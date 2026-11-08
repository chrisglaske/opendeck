import { Check, Crop, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Handle } from '../../model/geometry'
import type { ImageEl, Rect } from '../../model/types'
import { imageLayout } from '../../render/elements/ImageView'
import { useAssetUrl } from '../../storage/assets'
import { Button } from '../../ui'
import { useEditor, useEditorStore } from '../EditorContext'
import { endCrop, useCropId } from './cropSession'
import { writeBack } from './useCanvasGestures'
import { useDrag } from './useDrag'
import { worldItem } from './world'
import bar from './QuickBar.module.css'
import s from './CropMode.module.css'

const HANDLES: Handle[] = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br']
/** Smallest crop frame, in slide units. */
const MIN_FRAME = 8
const RAD = Math.PI / 180

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * The crop region (0..1 of the source) that a frame shows, given where the
 * whole image sits. Both rects use the same units. The part of the frame
 * outside the image is ignored, so the result always stays inside 0..1.
 */
export function cropFromFrame(source: { w: number; h: number }, frame: Rect, imageRect: Rect): Rect {
  const iw = Math.max(1e-9, imageRect.w), ih = Math.max(1e-9, imageRect.h)
  const x0 = clamp((frame.x - imageRect.x) / iw, 0, 1)
  const y0 = clamp((frame.y - imageRect.y) / ih, 0, 1)
  const x1 = clamp((frame.x + frame.w - imageRect.x) / iw, 0, 1)
  const y1 = clamp((frame.y + frame.h - imageRect.y) / ih, 0, 1)
  // At least one source pixel wide and high.
  const minW = 1 / Math.max(1, source.w), minH = 1 / Math.max(1, source.h)
  const w = Math.max(minW, x1 - x0), h = Math.max(minH, y1 - y0)
  const round = (n: number) => Math.round(n * 1e6) / 1e6
  return { x: round(Math.min(x0, 1 - w)), y: round(Math.min(y0, 1 - h)), w: round(w), h: round(h) }
}

type State = { frame: Rect; image: Rect }

/** The crop frame and the whole image, in the image box's own (unrotated) units. */
function initialState(el: ImageEl, natural: { w: number; h: number }): State {
  const { frame, image } = imageLayout({ w: el.w, h: el.h }, natural, el.crop, el.fit)
  const whole = { x: frame.x + image.x, y: frame.y + image.y, w: image.w, h: image.h }
  // Fill shows the box (the crop region overflows it); fit shows the crop region inside the box.
  const visible = el.fit === 'fill' ? { x: 0, y: 0, w: el.w, h: el.h } : frame
  return { frame: visible, image: whole }
}

/**
 * Crop mode: the whole picture shows dimmed around a frame with eight
 * handles. Drag a handle to crop, drag inside the frame to move the picture.
 * Done (or Enter, a click outside, or selecting something else) applies it
 * as one undo step; Cancel or Esc leaves the image as it was.
 */
export function CropMode({ scale }: { scale: number }) {
  const id = useCropId()
  const slide = useEditor((st) => st.deck.slides.find((x) => x.id === st.selection.slideId) ?? st.deck.slides[0])
  const item = id ? worldItem(slide, id) : null
  if (!id || !item || item.el.type !== 'image') return null
  return <Cropper key={`${id}:${item.el.assetId}`} el={item.el} scale={scale} slideId={slide.id} toLocal={item.toLocal} />
}

function Cropper({ el, scale, slideId, toLocal }: { el: ImageEl; scale: number; slideId: string; toLocal: (e: ImageEl) => unknown }) {
  const store = useEditorStore()
  const url = useAssetUrl(el.assetId)
  const startDrag = useDrag()
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [st, setSt] = useState<State | null>(null)
  const latest = useRef({ st, natural })
  latest.current = { st, natural }

  const done = () => {
    const { st: cur, natural: nat } = latest.current
    endCrop()
    if (!cur || !nat) return
    const crop = cropFromFrame(nat, cur.frame, cur.image)
    const f = cur.frame
    // The box becomes the frame: move its center by the frame's offset, turned with the image.
    const dx = f.x + f.w / 2 - el.w / 2, dy = f.y + f.h / 2 - el.h / 2
    const c = Math.cos(el.rotation * RAD), sn = Math.sin(el.rotation * RAD)
    const cx = el.x + el.w / 2 + dx * c - dy * sn, cy = el.y + el.h / 2 + dx * sn + dy * c
    const next: ImageEl = { ...el, x: cx - f.w / 2, y: cy - f.h / 2, w: f.w, h: f.h, crop }
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
    const same = (['x', 'y', 'w', 'h'] as const).every((k) => near(next[k], el[k]) && near(next.crop[k], el.crop[k]))
    if (!same) store.apply(writeBack(slideId, new Map([[el.id, toLocal(next) as ImageEl]])))
  }
  const cancel = () => endCrop()
  const reset = () => setSt((cur) => (cur ? { ...cur, frame: { ...cur.image } } : cur))
  const actions = useRef({ done, cancel })
  actions.current = { done, cancel }

  // Enter applies, Esc cancels; selecting something else applies, like a click outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return
      const t = e.target
      if (t instanceof Element && t.closest('button')) return
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Enter') actions.current.done()
      else actions.current.cancel()
    }
    window.addEventListener('keydown', onKey, true)
    const unsub = store.subscribe(() => {
      if (!store.getState().selection.ids.includes(el.id)) actions.current.done()
    })
    return () => {
      window.removeEventListener('keydown', onKey, true)
      unsub()
    }
  }, [store, el.id])

  /** A screen-pixel pointer delta in the image box's own units. */
  const toBox = (dx: number, dy: number) => {
    const c = Math.cos(-el.rotation * RAD), sn = Math.sin(-el.rotation * RAD)
    return { x: (dx * c - dy * sn) / scale, y: (dx * sn + dy * c) / scale }
  }

  const onHandle = (e: ReactPointerEvent, h: Handle) => {
    if (e.button !== 0 || !st) return
    e.preventDefault()
    e.stopPropagation()
    const start = st
    const x0 = e.clientX, y0 = e.clientY
    startDrag(e, {
      move(ev) {
        const d = toBox(ev.clientX - x0, ev.clientY - y0)
        const { frame: f, image: im } = start
        let l = f.x, t = f.y, r = f.x + f.w, b = f.y + f.h
        if (h[1] === 'l') l = clamp(l + d.x, im.x, r - MIN_FRAME)
        if (h[1] === 'r') r = clamp(r + d.x, l + MIN_FRAME, im.x + im.w)
        if (h[0] === 't') t = clamp(t + d.y, im.y, b - MIN_FRAME)
        if (h[0] === 'b') b = clamp(b + d.y, t + MIN_FRAME, im.y + im.h)
        setSt({ image: im, frame: { x: l, y: t, w: r - l, h: b - t } })
      },
      end() {},
      cancel: () => setSt(start),
    })
  }

  const onPan = (e: ReactPointerEvent) => {
    if (e.button !== 0 || !st) return
    e.preventDefault()
    e.stopPropagation()
    const start = st
    const x0 = e.clientX, y0 = e.clientY
    startDrag(e, {
      move(ev) {
        const d = toBox(ev.clientX - x0, ev.clientY - y0)
        const { frame: f, image: im } = start
        // The picture must keep covering the frame.
        const x = clamp(im.x + d.x, f.x + f.w - im.w, f.x)
        const y = clamp(im.y + d.y, f.y + f.h - im.h, f.y)
        setSt({ frame: f, image: { ...im, x, y } })
      },
      end() {},
      cancel: () => setSt(start),
    })
  }

  const px = (n: number) => `${n * scale}px`
  const rectStyle = (r: Rect) => ({ left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) })

  return (
    <div
      className={s.root}
      data-crop-mode=""
      onPointerDown={(e) => {
        // A press outside the frame applies the crop.
        e.stopPropagation()
        if (e.button === 0) done()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className={s.dim} />
      <div
        className={s.box}
        style={{ ...rectStyle({ x: el.x, y: el.y, w: el.w, h: el.h }), transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined }}
      >
        {url && (
          <img
            className={s.whole}
            src={url}
            alt=""
            draggable={false}
            style={st ? rectStyle(st.image) : { visibility: 'hidden' }}
            onLoad={(e) => {
              const nat = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }
              setNatural(nat)
              setSt((cur) => cur ?? initialState(el, nat))
            }}
          />
        )}
        {st && natural && (
          <div className={s.frame} data-crop-frame="" style={rectStyle(st.frame)} onPointerDown={onPan}>
            <div className={s.clip}>
              <img
                src={url ?? undefined}
                alt=""
                draggable={false}
                className={s.inner}
                style={rectStyle({ x: st.image.x - st.frame.x, y: st.image.y - st.frame.y, w: st.image.w, h: st.image.h })}
              />
              <div className={s.thirds} />
            </div>
            {HANDLES.map((h) => (
              <div key={h} className={s.handle} data-crop-handle={h} onPointerDown={(e) => onHandle(e, h)} />
            ))}
          </div>
        )}
      </div>
      {st && (
        <div
          role="toolbar"
          aria-label="Crop"
          className={`${bar.bar} ${s.bar}`}
          style={{ left: px(el.x), top: `${Math.max(8, el.y * scale - 48)}px` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className={s.label}>
            <Crop size={14} strokeWidth={1.75} aria-hidden />
            Cropping
          </span>
          <span className={bar.sep} aria-hidden />
          <Button size="sm" variant="ghost" icon={RotateCcw} className={bar.textButton} onClick={reset}>
            Reset
          </Button>
          <Button size="sm" variant="ghost" className={bar.textButton} onClick={cancel}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" icon={Check} className={bar.textButton} onClick={done}>
            Done
          </Button>
        </div>
      )}
    </div>
  )
}
