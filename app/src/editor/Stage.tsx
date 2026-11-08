import { PanelRightOpen } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, ReactNode, RefObject } from 'react'
import { SLIDE_H, SLIDE_W } from '../model/types'
import type { Point } from '../model/types'
import { SlideView } from '../render/SlideView'
import { IconButton } from '../ui'
import { bounds, unionRect } from '../model/geometry'
import { ElementMenu } from './canvas/ContextMenu'
import { CropMode } from './canvas/CropMode'
import { Overlay } from './canvas/Overlay'
import { QuickBar } from './canvas/QuickBar'
import { TextEditor } from './canvas/TextEditor'
import { exitTextEditing, watchTextEditing, writeParagraphs } from './canvas/textSession'
import { useCanvasGestures } from './canvas/useCanvasGestures'
import { useCanvasKeys } from './canvas/useCanvasKeys'
import { worldItems } from './canvas/world'
import { useClipboard } from './clipboard'
import { addImages, imageFiles } from './media'
import { Dock } from './Dock'
import { useEditor, useEditorStore } from './EditorContext'
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
  const canvas = useCanvasGestures(frame, scale, toSlidePoint)
  const store = useEditorStore()
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  useClipboard()
  useEffect(() => watchTextEditing(store), [store])

  // The context menu key opens the menu at the selection's top-right corner.
  useCanvasKeys(() => {
    const st = store.getState()
    const items = worldItems(slide, st.selection.ids)
    const r = frame?.getBoundingClientRect()
    if (!items.length || !r) return
    const b = unionRect(items.map((i) => bounds(i.el)))
    setMenu({ x: r.left + (b.x + b.w) * scale, y: r.top + b.y * scale })
  })

  const onContextMenu = (e: MouseEvent) => {
    // Inside the text being edited, the browser's menu (spelling, copy) is more useful.
    if ((e.target as HTMLElement).closest('[data-text-editor]')) return
    e.preventDefault()
    if (canvas.selectAt(e.clientX, e.clientY)) setMenu({ x: e.clientX, y: e.clientY })
  }

  // Image files dropped on the canvas land where they are dropped.
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    const files = imageFiles(e.dataTransfer.files)
    const all = Array.from(e.dataTransfer.files)
    // Non-image files still go through the import, which explains why they can't be used.
    void addImages(store, files.length ? files : all.slice(0, 1), toSlidePoint(e.clientX, e.clientY))
  }

  // Links on the slide work when presenting; while editing a click selects instead.
  const stopLinks = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a[href]')) e.preventDefault()
  }

  return (
    <StageContext.Provider value={api}>
      <main ref={setStageEl} className={styles.stage} aria-label="Slide canvas">
        <div ref={scrollerRef} className={styles.scroller} data-stage-scroller="">
          <div className={styles.content} {...canvas.canvasHandlers} onContextMenu={onContextMenu} onDragOver={onDragOver} onDrop={onDrop}>
            <div
              ref={setFrame}
              className={styles.frame}
              style={{ width: `${SLIDE_W * scale}px`, height: `${SLIDE_H * scale}px` }}
              onClickCapture={stopLinks}
            >
              <div className={styles.slide}>
                {slide && (
                  <SlideView
                    slide={slide}
                    theme={theme}
                    scale={scale}
                    editingId={editingId}
                    renderTextEditor={(el) => (
                      <TextEditor
                        key={el.id}
                        el={el}
                        theme={theme}
                        onCommit={(ps, coalesce) => writeParagraphs(store, el.id, ps, coalesce)}
                        onExit={() => exitTextEditing(store)}
                      />
                    )}
                  />
                )}
              </div>
              <Overlay
                scale={scale}
                hoverId={canvas.hoverId}
                visuals={canvas.visuals}
                onResize={canvas.startResize}
                onRotate={canvas.startRotate}
                onEndpoint={canvas.startEndpoint}
              />
              <CropMode scale={scale} />
              {children}
            </div>
          </div>
        </div>
        <QuickBar frame={frame} scale={scale} container={stageEl} hidden={canvas.busy || menu !== null} onMore={(x, y) => setMenu({ x, y })} />
        {menu && <ElementMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
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
