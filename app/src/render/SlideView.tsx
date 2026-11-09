import type { ReactNode } from 'react'
import { resolveColor, themeVars } from '../model/theme'
import type { Theme } from '../model/theme'
import { SLIDE_H, SLIDE_W } from '../model/types'
import type { GroupEl, Slide, SlideElement, TextEl } from '../model/types'
import { useAssetUrl } from '../storage/assets'
import { boxStyle } from './elements/box'
import { IconView } from './elements/IconView'
import { ImageView } from './elements/ImageView'
import { LineView } from './elements/LineView'
import { LogoView } from './elements/LogoView'
import { ShapeView } from './elements/ShapeView'
import { TextView } from './elements/TextView'
import s from './SlideView.module.css'

type RenderCtx = {
  theme: Theme; slide: Slide; placeholders: boolean; editingId: string | null; renderTextEditor?: (el: TextEl) => ReactNode
}

export type SlideViewProps = {
  slide: Slide
  theme: Theme
  /** Screen pixels per slide unit. The slide is laid out at 1920×1080 and scaled from the top-left. */
  scale: number
  /** False for thumbnails: hidden from assistive tech and from the pointer. */
  interactive?: boolean
  /** The text element being edited; it is drawn by `renderTextEditor` instead. */
  editingId?: string | null
  renderTextEditor?: (el: TextEl) => ReactNode
  /** Draw placeholders for empty theme slots (e.g. a logo box with no logo). Only the editing canvas does. */
  placeholders?: boolean
  /**
   * Elements parked beside the slide: `'hide'` (the default, for present, thumbnails and export)
   * skips them; `'only'` draws just them, with no background and no clipping (the editing canvas).
   */
  aside?: 'hide' | 'only'
}

/** The one slide renderer, shared by the canvas, the rail thumbnails, present and export. */
export function SlideView({ slide, theme, scale, interactive = true, editingId = null, renderTextEditor, placeholders = false, aside = 'hide' }: SlideViewProps) {
  const ctx: RenderCtx = { theme, slide, placeholders, editingId, renderTextEditor }
  const only = aside === 'only'
  const elements = slide.elements.filter((el) => (only ? el.aside : !el.aside))
  return (
    <div
      className={only ? `${s.root} ${s.asideOnly}` : s.root}
      data-slide-root=""
      aria-hidden={interactive ? undefined : true}
      // Thumbnails can't be focused or clicked into (e.g. links inside them).
      inert={!interactive || undefined}
      style={{
        ...themeVars(theme),
        width: `${SLIDE_W}px`,
        height: `${SLIDE_H}px`,
        transform: `scale(${scale})`,
        backgroundColor: only ? undefined : resolveColor(slide.background.color),
        pointerEvents: interactive ? undefined : 'none',
      }}
    >
      {!only && slide.background.imageId ? <BackgroundImage assetId={slide.background.imageId} /> : null}
      {elements.map((el) => <ElementView key={el.id} el={el} ctx={ctx} />)}
    </div>
  )
}

function BackgroundImage({ assetId }: { assetId: string }) {
  const url = useAssetUrl(assetId)
  return url ? <img className={s.background} src={url} alt="" draggable={false} /> : null
}

function ElementView({ el, ctx }: { el: SlideElement; ctx: RenderCtx }) {
  switch (el.type) {
    case 'text':
      return el.id === ctx.editingId && ctx.renderTextEditor ? ctx.renderTextEditor(el) : <TextView el={el} theme={ctx.theme} />
    case 'shape':
      return <ShapeView el={el} theme={ctx.theme} />
    case 'image':
      return <ImageView el={el} />
    case 'icon':
      return <IconView el={el} />
    case 'logo':
      return <LogoView el={el} theme={ctx.theme} slide={ctx.slide} placeholders={ctx.placeholders} />
    case 'line':
      return <LineView el={el} />
    case 'group':
      return <GroupView el={el} ctx={ctx} />
  }
}

/** Children use group-local coordinates; the group's own rotation turns them all at once. */
function GroupView({ el, ctx }: { el: GroupEl; ctx: RenderCtx }) {
  return (
    <div className={s.el} data-el-id={el.id} style={boxStyle(el)}>
      {el.children.map((c) => <ElementView key={c.id} el={c} ctx={ctx} />)}
    </div>
  )
}
