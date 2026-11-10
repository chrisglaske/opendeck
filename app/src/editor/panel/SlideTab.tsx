import { updateSlide } from '../../model/ops'
import { themeVars } from '../../model/theme'
import type { ColorRef, Slide, ThemeColorToken } from '../../model/types'
import { ChevronDown, ImageOff, ImagePlus, LayoutTemplate, Replace } from 'lucide-react'
import { useMemo } from 'react'
import type { Theme } from '../../model/theme'
import { SLIDE_W } from '../../model/types'
import { SlideView } from '../../render/SlideView'
import { templateByRef } from '../../templates/builtins'
import { groupLabel } from '../../templates/types'
import { useSlidesPanel } from '../slides/slidesPanelState'
import { useAssetUrl } from '../../storage/assets'
import { myTemplate, useMyTemplates } from '../../storage/templates'
import { Button, Toggle } from '../../ui'
import { useEditor, useEditorStore } from '../EditorContext'
import { pickImageFile, setBackgroundImage } from '../media'
import { ColorButton } from '../pickers/ColorPicker'
import styles from './Panel.module.css'

/** Theme colors offered as slide backgrounds; any other color comes from the picker below them. */
const BACKGROUNDS: { token: ThemeColorToken; label: string }[] = [
  { token: 'bg', label: 'Background' },
  { token: 'surface', label: 'Surface' },
  { token: 'accentTint', label: 'Accent tint' },
  { token: 'text', label: 'Dark' },
]

const isToken = (c: ColorRef, t: ThemeColorToken) => 'theme' in c && c.theme === t
const swatchVar = (t: ThemeColorToken) => `var(--t-${t.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())})`

/** Simple shows the layout as a card and only the theme backgrounds. */
export function SlideTab({ slide, simple = false }: { slide: Slide; simple?: boolean }) {
  const store = useEditorStore()
  const theme = useEditor((s) => s.deck.theme)
  const set = (patch: Parameters<typeof updateSlide>[2], coalesce?: string) =>
    store.apply((d) => updateSlide(d, slide.id, patch), coalesce ? { coalesce } : undefined)

  return (
    <div className={styles.body}>
      <LayoutField layout={slide.layout} theme={theme} simple={simple} />
      <section>
        <h2 className={styles.heading} id="bg-heading">Background</h2>
        {/* The swatches show this deck's theme colors, not the app's. */}
        <div role="radiogroup" aria-labelledby="bg-heading" className={styles.bgOptions} style={themeVars(theme)}>
          {BACKGROUNDS.map((b) => {
            // In Simple a background image covers the color, so no swatch shows as picked and picking one replaces the image.
            const on = !(simple && slide.background.imageId) && isToken(slide.background.color, b.token)
            return (
              <button
                key={b.token}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={b.label}
                title={b.label}
                className={styles.bgOption}
                style={{ backgroundColor: swatchVar(b.token) }}
                onClick={() => !on && set({ background: simple ? { color: { theme: b.token } } : { ...slide.background, color: { theme: b.token } } })}
              />
            )
          })}
        </div>
        {!simple && (
        <div className={styles.rowGap}>
          <ColorButton
            variant="field"
            label="Custom background color"
            noneLabel="None"
            value={'hex' in slide.background.color ? slide.background.color : null}
            onChange={(color) => color && set({ background: { ...slide.background, color } }, `bg:${slide.id}`)}
          />
        </div>
        )}
      </section>
      {!simple && (
      <section>
        <h2 className={styles.heading}>Background image</h2>
        <BackgroundImage
          imageId={slide.background.imageId}
          onPick={() => pickImageFile((f) => void setBackgroundImage(store, slide.id, f))}
          onRemove={() => {
            const { imageId: _removed, ...rest } = slide.background
            set({ background: rest })
          }}
        />
      </section>
      )}
      <section>
        <label className={styles.heading} htmlFor="slide-notes">Speaker notes</label>
        <textarea
          id="slide-notes"
          className={styles.notes}
          value={slide.notes}
          placeholder="What you want to say on this slide"
          maxLength={20000}
          onChange={(e) => set({ notes: e.target.value }, `notes:${slide.id}`)}
        />
      </section>
      <div className={styles.toggleRow}>
        <Toggle label="Hide this slide" checked={slide.hidden} onChange={(hidden) => set({ hidden })} />
        <span className={styles.hint}>Skipped when presenting</span>
      </div>
    </div>
  )
}

const MINI_W = 64
/** The slide's layout and a way to change it. A slide with no layout (or a removed one) shows "No layout". */
function LayoutField({ layout, theme, simple }: { layout?: string; theme: Theme; simple: boolean }) {
  const { changeLayout } = useSlidesPanel()
  // Re-reads when the person's templates change (renamed or deleted).
  useMyTemplates()
  const t = templateByRef(layout, myTemplate)
  const mini = useMemo(() => (t ? { id: t.id, ...t.slide, notes: '', hidden: false } : null), [t])
  const thumb = (
    <span className={`${styles.layoutMini} ${mini ? '' : styles.layoutNone}`}>
      {mini && <SlideView slide={mini} theme={theme} scale={MINI_W / SLIDE_W} interactive={false} />}
    </span>
  )
  if (simple) {
    return (
      <section>
        <h2 className={styles.heading}>Layout</h2>
        <div className={styles.layoutCard}>
          {thumb}
          <span className={styles.grow}>
            <span className={styles.layoutName}>{t ? t.name : 'No layout'}</span>
            <span className={styles.layoutHint}>{t ? 'Your text moves with you' : 'Pick one to restyle this slide'}</span>
          </span>
        </div>
        <Button size="sm" variant="secondary" icon={LayoutTemplate} className={styles.changeLayout} onClick={changeLayout}>
          Change layout
        </Button>
      </section>
    )
  }
  return (
    <section>
      <h2 className={styles.heading}>Layout</h2>
      <button type="button" className={styles.layoutField} onClick={changeLayout}>
        <span className={`${styles.layoutMini} ${mini ? '' : styles.layoutNone}`}>
          {mini && <SlideView slide={mini} theme={theme} scale={MINI_W / SLIDE_W} interactive={false} />}
        </span>
        <span className={styles.grow}>
          <span className={styles.layoutName}>{t ? t.name : 'No layout'}</span>
          <span className={styles.layoutHint}>{t ? groupLabel(t.group) : 'Pick one to restyle this slide'}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </section>
  )
}

/** The slide's background picture, drawn under everything and cropped to cover the slide. */
function BackgroundImage({ imageId, onPick, onRemove }: { imageId?: string; onPick(): void; onRemove(): void }) {
  const url = useAssetUrl(imageId)
  if (!imageId) {
    return (
      <Button size="sm" variant="secondary" icon={ImagePlus} onClick={onPick}>
        Add image
      </Button>
    )
  }
  return (
    <div className={styles.bgImage}>
      {url ? <img className={styles.bgPreview} src={url} alt="" /> : <span className={styles.bgPreview} />}
      <div className={styles.bgActions}>
        <Button size="sm" variant="ghost" icon={Replace} onClick={onPick}>
          Replace
        </Button>
        <Button size="sm" variant="ghost" icon={ImageOff} onClick={onRemove}>
          Remove image
        </Button>
      </div>
    </div>
  )
}
