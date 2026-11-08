import { PanelRightOpen } from 'lucide-react'
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, ReactNode, RefObject } from 'react'
import { SLIDE_H, SLIDE_W } from '../model/types'
import type { Point } from '../model/types'
import { SlideView } from '../render/SlideView'
import { IconButton } from '../ui'
import { Dock } from './Dock'
import { useEditor } from './EditorContext'
import { ZoomControl } from './ZoomControl'
import type { Zoom } from './ZoomControl'
import styles from './Stage.module.css'

/** Space around the fitted slide: top, right, bottom, left (the left side leaves room for the dock). */
export const STAGE_PADDING = { top: 56, right: 36, bottom: 56, left: 76 }
const MIN_SCALE = 0.05

export type StageApi = {
  /** Screen pixels per slide unit. */
  scale: number
  /** Converts a pointer position to slide units. */
  toSlidePoint(clientX: number, clientY: number): Point
  /** The slide frame element; overlays for selection and guides go inside it. */
  frame: HTMLDivElement | null
}

const StageContext = createContext<StageApi | null>(null)

export function useStage(): StageApi {
  const s = useContext(StageContext)
  if (!s) throw new Error('useStage must be used inside <Stage>')
  return s
}

export const useStageScale = () => useStage().scale

/** The scale at which the whole slide fits a viewport of the given size. */
export function fitScale(w: number, h: number): number {
  const sw = (w - STAGE_PADDING.left - STAGE_PADDING.right) / SLIDE_W
  const sh = (h - STAGE_PADDING.top - STAGE_PADDING.bottom) / SLIDE_H
  return Math.max(MIN_SCALE, Math.min(sw, sh))
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

export function Stage({
  zoom,
  onZoom,
  panelHidden,
  onShowPanel,
  children,
}: {
  zoom: Zoom
  onZoom(z: Zoom): void
  panelHidden: boolean
  onShowPanel(): void
  /** Editing overlays, drawn above the slide inside the frame. */
  children?: ReactNode
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const size = useElementSize(scrollerRef)
  const fit = fitScale(size.w, size.h)
  const scale = zoom === 'fit' ? fit : zoom / 100

  const theme = useEditor((s) => s.deck.theme)
  const slide = useEditor((s) => s.deck.slides.find((x) => x.id === s.selection.slideId) ?? s.deck.slides[0])
  const editingId = useEditor((s) => s.editingId)

  const toSlidePoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const r = frame?.getBoundingClientRect()
      if (!r) return { x: 0, y: 0 }
      return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale }
    },
    [frame, scale],
  )
  const api = useMemo<StageApi>(() => ({ scale, toSlidePoint, frame }), [scale, toSlidePoint, frame])

  // Links on the slide work when presenting; while editing a click selects instead.
  const stopLinks = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a[href]')) e.preventDefault()
  }

  return (
    <StageContext.Provider value={api}>
      <main className={styles.stage} aria-label="Slide canvas">
        <div ref={scrollerRef} className={styles.scroller} data-stage-scroller="">
          <div className={styles.content}>
            <div
              ref={setFrame}
              className={styles.frame}
              style={{ width: `${SLIDE_W * scale}px`, height: `${SLIDE_H * scale}px` }}
              onClickCapture={stopLinks}
            >
              {slide && <SlideView slide={slide} theme={theme} scale={scale} editingId={editingId} />}
              {children}
            </div>
          </div>
        </div>
        <Dock />
        <ZoomControl zoom={zoom} fit={fit} onZoom={onZoom} />
        {panelHidden && (
          <div className={`${styles.chip} ${styles.showPanel}`}>
            <IconButton icon={PanelRightOpen} label="Show panel" size="sm" onClick={onShowPanel} />
          </div>
        )}
      </main>
    </StageContext.Provider>
  )
}
