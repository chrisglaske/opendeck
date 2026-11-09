import { Eye, PanelRightOpen } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, ReactNode, RefObject } from 'react'
import { ASIDE_GAP, ASIDE_W, ASIDE_X } from '../model/aside'
import { SLIDE_H, SLIDE_W } from '../model/types'
import type { Point, Slide, TextEl } from '../model/types'
import { SlideView } from '../render/SlideView'
import { ContextMenu, IconButton } from '../ui'
import { deleteSlides, duplicateSlides, updateSlide } from '../model/ops'
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
import { addImages, imageFiles, replaceImage } from './media'
import { AsideLayer } from './AsideLayer'
import { Dock } from './Dock'
import { useEditor, useEditorStore } from './EditorContext'
import { useLayoutPreview } from './slides/layoutPreview'
import { slideMenuItems } from './slides/slideMenu'
import { useSlidesPanel } from './slides/slidesPanelState'
import { useDisplayTheme, usePreviewTheme } from './theme/themePreview'
import pillStyles from './theme/ThemePanel.module.css'
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

/**
 * The scale at which the whole slide fits a viewport of the given size. `width` is the
 * area to fit in slide units: wider than the slide when elements are parked beside it.
 */
export function fitScale(w: number, h: number, width = SLIDE_W, height = SLIDE_H): number {
  const sw = (w - STAGE_PADDING.left - STAGE_PADDING.right) / width
  const sh = (h - STAGE_PADDING.top - STAGE_PADDING.bottom) / height
  return Math.max(MIN_SCALE, Math.min(sw, sh))
}

/**
 * The area the canvas shows, in slide units: wider (and taller, when they reach below the slide)
 * when elements are parked beside it, so they're all visible at Fit.
 */
export function stageSize(slide: Slide | undefined): { w: number; h: number } {
  const parked = slide?.elements.filter((e) => e.aside) ?? []
  if (parked.length === 0) return { w: SLIDE_W, h: SLIDE_H }
  const low = Math.max(...parked.map((e) => { const b = bounds(e); return b.y + b.h }))
  return { w: ASIDE_X + ASIDE_W, h: Math.max(SLIDE_H, Math.ceil(low + ASIDE_GAP)) }
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
  const theme = useDisplayTheme()
  const previewing = usePreviewTheme()
  const slide = useEditor((s) => s.deck.slides.find((x) => x.id === s.selection.slideId) ?? s.deck.slides[0])
  const editingId = useEditor((s) => s.editingId)
  // While a layout card is hovered in Change layout, the canvas shows the slide in that layout.
  const layoutPreview = useLayoutPreview()
  const shownLayout = layoutPreview && slide && layoutPreview.slideId === slide.id ? layoutPreview : null
  const area = stageSize(shownLayout?.slide ?? slide)
  const width = area.w
  const fit = fitScale(size.w, size.h, area.w, area.h)
  const scale = zoom === 'fit' ? fit : zoom / 100

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
  const [slideMenu, setSlideMenu] = useState<{ x: number; y: number } | null>(null)
  const slidesPanel = useSlidesPanel()
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
    if (canvas.selectAt(e.clientX, e.clientY)) return setMenu({ x: e.clientX, y: e.clientY })
    // An empty part of the slide opens the slide's own menu, the same one as in the rail.
    const p = toSlidePoint(e.clientX, e.clientY)
    if (slide && p.x >= 0 && p.y >= 0 && p.x <= SLIDE_W && p.y <= SLIDE_H) setSlideMenu({ x: e.clientX, y: e.clientY })
  }

  const slideMenuFor = (s: Slide) =>
    slideMenuItems({
      ids: [s.id],
      slides: [s],
      onDuplicate: () => {
        const r = duplicateSlides(store.getState().deck, [s.id])
        if (r.slideIds.length) store.apply(() => r.deck, { selection: { slideId: r.slideIds[0], ids: [] } })
      },
      onSetHidden: (hidden) => store.apply((d) => updateSlide(d, s.id, { hidden })),
      onSaveTemplate: () => slidesPanel.saveAsTemplate(s.id),
      onDelete: () => {
        const r = deleteSlides(store.getState().deck, [s.id])
        store.apply(() => r.deck, { selection: { slideId: r.nextSlideId, ids: [] } })
      },
    })

  // Image files dropped on the canvas land where they are dropped; one dropped on a picture replaces it.
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
    const target = files.length === 1 ? canvas.imageAt(e.clientX, e.clientY) : null
    if (target) return void replaceImage(store, store.getState().selection.slideId, target, files[0])
    // Non-image files still go through the import, which explains why they can't be used.
    void addImages(store, files.length ? files : all.slice(0, 1), toSlidePoint(e.clientX, e.clientY))
  }

  const renderTextEditor = (el: TextEl) => (
    <TextEditor
      key={el.id}
      el={el}
      theme={theme}
      onCommit={(ps, coalesce) => writeParagraphs(store, el.id, ps, coalesce)}
      onExit={() => exitTextEditing(store)}
    />
  )

  // Links on the slide work when presenting; while editing a click selects instead.
  const stopLinks = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a[href]')) e.preventDefault()
  }

  return (
    <StageContext.Provider value={api}>
      <main ref={setStageEl} className={styles.stage} aria-label="Slide canvas">
        <div ref={scrollerRef} className={styles.scroller} data-stage-scroller="">
          <div className={styles.content} {...canvas.canvasHandlers} onContextMenu={onContextMenu} onDragOver={onDragOver} onDrop={onDrop}>
            <div className={styles.area} style={{ width: `${width * scale}px`, height: `${area.h * scale}px` }}>
            <div
              ref={setFrame}
              data-slide-frame=""
              className={styles.frame}
              style={{ width: `${SLIDE_W * scale}px`, height: `${SLIDE_H * scale}px` }}
              onClickCapture={stopLinks}
            >
              <div className={styles.slide}>
                {shownLayout ? (
                  <SlideView slide={shownLayout.slide} theme={theme} scale={scale} interactive={false} />
                ) : slide && (
                  <SlideView
                    slide={slide}
                    theme={theme}
                    scale={scale}
                    placeholders
                    editingId={editingId}
                    renderTextEditor={renderTextEditor}
                  />
                )}
              </div>
              {shownLayout ? (
                <AsideLayer slide={shownLayout.slide} theme={theme} scale={scale} editingId={null} renderTextEditor={renderTextEditor} />
              ) : (
                slide && <AsideLayer slide={slide} theme={theme} scale={scale} editingId={editingId} renderTextEditor={renderTextEditor} />
              )}
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
        </div>
        <QuickBar frame={frame} scale={scale} container={stageEl} hidden={canvas.busy || menu !== null || slideMenu !== null} onMore={(x, y) => setMenu({ x, y })} />
        {menu && <ElementMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
        {slideMenu && slide && (
          <ContextMenu x={slideMenu.x} y={slideMenu.y} label="Slide actions" items={slideMenuFor(slide)} onClose={() => setSlideMenu(null)} />
        )}
        <Dock />
        {(shownLayout || previewing) && (
          <div className={pillStyles.pill} data-preview-pill="" role="status">
            <Eye size={14} strokeWidth={1.75} aria-hidden />
            <span>
              Previewing <b>{shownLayout ? shownLayout.name : previewing!.name}</b> · {shownLayout ? 'click to switch' : 'click to apply'}
            </span>
          </div>
        )}
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
