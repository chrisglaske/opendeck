import { updateSlide } from '../../model/ops'
import { themeVars } from '../../model/theme'
import type { ColorRef, Slide, ThemeColorToken } from '../../model/types'
import { ImageOff, ImagePlus, Replace } from 'lucide-react'
import { useAssetUrl } from '../../storage/assets'
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

export function SlideTab({ slide }: { slide: Slide }) {
  const store = useEditorStore()
  const theme = useEditor((s) => s.deck.theme)
  const set = (patch: Parameters<typeof updateSlide>[2], coalesce?: string) =>
    store.apply((d) => updateSlide(d, slide.id, patch), coalesce ? { coalesce } : undefined)

  return (
    <div className={styles.body}>
      <section>
        <h2 className={styles.heading} id="bg-heading">Background</h2>
        {/* The swatches show this deck's theme colors, not the app's. */}
        <div role="radiogroup" aria-labelledby="bg-heading" className={styles.bgOptions} style={themeVars(theme)}>
          {BACKGROUNDS.map((b) => {
            const on = isToken(slide.background.color, b.token)
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
                onClick={() => !on && set({ background: { ...slide.background, color: { theme: b.token } } })}
              />
            )
          })}
        </div>
        <div className={styles.rowGap}>
          <ColorButton
            variant="field"
            label="Custom background color"
            noneLabel="None"
            value={'hex' in slide.background.color ? slide.background.color : null}
            onChange={(color) => color && set({ background: { ...slide.background, color } }, `bg:${slide.id}`)}
          />
        </div>
      </section>
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
