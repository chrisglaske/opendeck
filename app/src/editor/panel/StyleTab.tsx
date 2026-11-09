import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Baseline, MoveLeft, MoveRight, Space, Unlink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { findElement, updateElements } from '../../model/ops'
import { radiusPx, resolveColor, themeVars } from '../../model/theme'
import { detachLogo, logoAssetFor } from '../../model/themeOps'
import type { ColorRef, FadeDir, IconEl, ImageEl, LineEl, LogoEl, ShapeEl, Slide, TextEl, TextStyleId, ThemeColorToken } from '../../model/types'
import { Button, IconButton, NumberField, SegmentedControl, Toggle } from '../../ui'
import { useTextSession } from '../canvas/textSession'
import { useEditor, useEditorStore } from '../EditorContext'
import { customColors, themeColorName } from '../pickers/color'
import { ColorButton } from '../pickers/ColorPicker'
import { useOpenDeckTheme } from '../theme/themeEditorRequest'
import { textCommands } from '../textCommands'
import styles from './Panel.module.css'

const TEXT_STYLES: { id: TextStyleId; name: string }[] = [
  { id: 'title', name: 'Title' },
  { id: 'heading', name: 'Heading' },
  { id: 'body', name: 'Body' },
  { id: 'caption', name: 'Caption' },
]

/** The theme colors offered for text, most used first. */
const TEXT_THEME_COLORS: ThemeColorToken[] = ['text', 'muted', 'accent', 'accent2', 'bg']

const sameColor = (a: ColorRef, b: ColorRef) =>
  'theme' in a ? 'theme' in b && a.theme === b.theme : 'hex' in b && a.hex.toUpperCase() === b.hex.toUpperCase()

/** Style settings for one selected element. Groups have none of their own. */
export function StyleTab({ slide, id }: { slide: Slide; id: string }) {
  const el = findElement(slide, id)?.el
  if (el?.type === 'text') return <TextStyle slideId={slide.id} el={el} />
  if (el?.type === 'shape') return <ShapeStyle slideId={slide.id} el={el} />
  if (el?.type === 'line') return <LineStyle slideId={slide.id} el={el} />
  if (el?.type === 'image') return <ImageStyle slideId={slide.id} el={el} />
  if (el?.type === 'icon') return <IconStyle slideId={slide.id} el={el} />
  if (el?.type === 'logo') return <LogoStyle slide={slide} el={el} />
  return null
}

function TextStyle({ slideId, el }: { slideId: string; el: TextEl }) {
  const store = useEditorStore()
  const deck = useEditor((st) => st.deck)
  const theme = deck.theme
  const session = useTextSession()
  const cmd = textCommands(store, slideId, el, theme, session)
  const customs = customColors(deck)
  const t = theme.text[el.style]
  const lineHeight = el.lineHeight ?? t.lineHeight
  const letterSpacing = el.letterSpacing ?? t.letterSpacing
  const refocus = session ? () => session.focus() : undefined

  return (
    <div className={styles.styleTab} style={themeVars(theme)}>
      <section>
        <h3 className={styles.heading}>Text style</h3>
        <div className={styles.styleRows}>
          {TEXT_STYLES.map((s) => {
            const ts = theme.text[s.id]
            return (
              <button
                key={s.id}
                type="button"
                className={styles.styleRow}
                aria-pressed={el.style === s.id && el.size === undefined && el.font === undefined && el.fontFamily === undefined}
                onClick={() => cmd.setStyle(s.id)}
              >
                <span className={styles[`preview_${s.id}`]} style={{ fontFamily: `var(--t-font-${ts.font})`, fontWeight: ts.weight }}>
                  {s.name}
                </span>
                <em>
                  {theme.fonts[ts.font]} · {ts.size}
                </em>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className={styles.heading}>Color</h3>
        <div className={styles.swatches}>
          {TEXT_THEME_COLORS.map((token) => {
            const c: ColorRef = { theme: token }
            return (
              <button
                key={token}
                type="button"
                className={styles.swatch}
                aria-label={themeColorName(token)}
                title={themeColorName(token)}
                aria-pressed={sameColor(cmd.color, c)}
                style={{ backgroundColor: resolveColor(c) }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => cmd.setColor(c)}
              />
            )
          })}
        </div>
        <p className={styles.swatchNote}>Theme colors · follow the theme</p>
        <div className={`${styles.swatches} ${styles.swatchesGap}`}>
          {customs.map((hex) => (
            <button
              key={hex}
              type="button"
              className={styles.swatch}
              aria-label={hex}
              title={hex}
              aria-pressed={sameColor(cmd.color, { hex })}
              style={{ backgroundColor: hex }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => cmd.setColor({ hex })}
            />
          ))}
          <ColorButton variant="add" label="Custom text color" value={cmd.color} onChange={(c) => c && cmd.setColor(c)} onClosed={refocus} />
        </div>
        <p className={styles.swatchNote}>Custom · stay as set</p>
      </section>

      <section>
        <h3 className={styles.heading}>Paragraph</h3>
        <div className={styles.grid2}>
          <NumberField
            label="Line height"
            prefix={<Baseline size={14} strokeWidth={1.75} />}
            min={0.5}
            max={4}
            step={0.05}
            value={Math.round(lineHeight * 100) / 100}
            onChange={cmd.setLineHeight}
          />
          <NumberField
            label="Letter spacing"
            prefix={<Space size={14} strokeWidth={1.75} />}
            suffix="%"
            min={-20}
            max={100}
            step={0.5}
            value={Math.round(letterSpacing * 1000) / 10}
            onChange={(pct) => cmd.setLetterSpacing(pct / 100)}
          />
        </div>
      </section>

      <div className={styles.toggleRow}>
        <Toggle label="Auto-fit text" checked={el.autoFit} onChange={cmd.setAutoFit} />
        <span className={styles.hint}>Shrinks to stay in the box</span>
      </div>
      <Effects slideId={slideId} el={el} />
    </div>
  )
}

const FADES: [FadeDir, string, LucideIcon][] = [['up', 'top', ArrowUp], ['down', 'bottom', ArrowDown], ['left', 'left', ArrowLeft], ['right', 'right', ArrowRight]]

function withFade(e: ShapeEl, fade: FadeDir | undefined): ShapeEl {
  const { fade: _f, ...rest } = e
  return fade ? { ...rest, fade } : rest
}

type WithEffects = TextEl | ShapeEl | ImageEl

/** Opacity (5–100%) and a drop shadow, shared by text, shapes and pictures. */
function Effects({ slideId, el }: { slideId: string; el: WithEffects }) {
  const store = useEditorStore()
  const pct = Math.round((el.opacity ?? 1) * 100)
  const set = (field: string, fn: (e: WithEffects) => WithEffects) =>
    store.apply((d) => updateElements(d, slideId, [el.id], (e) => fn(e as WithEffects)), { coalesce: `${field}:${el.id}` })
  const setOpacity = (p: number) =>
    set('opacity', (e) => {
      const { opacity: _o, ...rest } = e
      const o = Math.min(100, Math.max(5, Math.round(p))) / 100
      return (o < 1 ? { ...rest, opacity: o } : rest) as WithEffects
    })
  return (
    <section>
      <h3 className={styles.heading}>Effects</h3>
      <p className={styles.fieldLabel}>Opacity</p>
      <div className={styles.sliderRow}>
        <input
          type="range"
          className={styles.slider}
          aria-label="Opacity"
          min={5}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => setOpacity(Number(e.target.value))}
        />
        <NumberField label="Opacity" suffix="%" size="sm" className={styles.sliderField} min={5} max={100} value={pct} onChange={setOpacity} />
      </div>
      <div className={styles.rowGap}>
        <Toggle
          label="Shadow"
          checked={el.shadow === true}
          onChange={(on) =>
            set('shadow', (e) => {
              const { shadow: _s, ...rest } = e
              return (on ? { ...rest, shadow: true } : rest) as WithEffects
            })
          }
        />
      </div>
    </section>
  )
}

function useUpdate<T extends ShapeEl | LineEl | ImageEl | IconEl>(slideId: string, el: T) {
  const store = useEditorStore()
  return (field: string, fn: (e: T) => T) =>
    store.apply((d) => updateElements(d, slideId, [el.id], (e) => fn(e as T)), { coalesce: `${field}:${el.id}` })
}

function ShapeStyle({ slideId, el }: { slideId: string; el: ShapeEl }) {
  const theme = useEditor((st) => st.deck.theme)
  const update = useUpdate(slideId, el)
  return (
    <>
      <section>
        <h3 className={styles.heading}>Fill</h3>
        <div className={styles.rowGapBelow}>
          <SegmentedControl
            label="Fill type"
            options={[{ value: 'solid', label: 'Solid' }, { value: 'fade', label: 'Fade' }]}
            value={el.fade ? 'fade' : 'solid'}
            onChange={(v) => update('fade', (e) => withFade(e, v === 'fade' ? 'up' : undefined))}
          />
        </div>
        <ColorButton variant="field" label="Fill color" value={el.fill} allowNone noneLabel="No fill" onChange={(fill) => update('fill', (e) => ({ ...e, fill }))} />
        {el.fade && (
          <div className={styles.rowGap}>
            <p className={styles.fieldLabel}>Fades toward</p>
            <div className={styles.buttonRow}>
              {FADES.map(([dir, side, icon]) => (
                <IconButton key={dir} icon={icon} label={`Fades toward ${side}`} pressed={el.fade === dir} onClick={() => update('fade', (e) => withFade(e, dir))} />
              ))}
            </div>
          </div>
        )}
      </section>
      <section>
        <h3 className={styles.heading}>Border</h3>
        <div className={styles.grid2}>
          <ColorButton
            variant="field"
            label="Border color"
            value={el.stroke?.color ?? null}
            allowNone
            noneLabel="No border"
            onChange={(color) => update('stroke', (e) => ({ ...e, stroke: color === null ? null : { width: 4, dash: 'solid', ...e.stroke, color } }))}
          />
          <NumberField
            label="Border width"
            suffix="px"
            min={0}
            max={200}
            value={el.stroke?.width ?? 0}
            onChange={(width) =>
              update('stroke', (e) => ({ ...e, stroke: width === 0 ? null : { color: { theme: 'text' }, dash: 'solid', ...e.stroke, width } }))
            }
          />
        </div>
        {el.stroke && (
          <div className={styles.rowGap}>
            <SegmentedControl
              label="Border style"
              options={[{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }]}
              value={el.stroke.dash}
              onChange={(dash) => update('dash', (e) => (e.stroke ? { ...e, stroke: { ...e.stroke, dash } } : e))}
            />
          </div>
        )}
      </section>
      {el.shape === 'rect' && (
        <section>
          <h3 className={styles.heading}>Corners</h3>
          <NumberField label="Corner radius" suffix="px" min={0} max={2000} value={Math.round(radiusPx(el.radius, theme))} onChange={(radius) => update('radius', (e) => ({ ...e, radius }))} />
          {el.radius === 'theme' ? (
            <p className={styles.swatchNote}>From theme</p>
          ) : (
            <button type="button" className={styles.noteLink} onClick={() => update('radius', (e) => ({ ...e, radius: 'theme' }))}>
              Use theme corners
            </button>
          )}
        </section>
      )}
      <Effects slideId={slideId} el={el} />
    </>
  )
}

function LineStyle({ slideId, el }: { slideId: string; el: LineEl }) {
  const update = useUpdate(slideId, el)
  return (
    <>
      <section>
        <h3 className={styles.heading}>Line</h3>
        <div className={styles.grid2}>
          <ColorButton variant="field" label="Line color" value={el.stroke.color} onChange={(color) => color && update('stroke', (e) => ({ ...e, stroke: { ...e.stroke, color } }))} />
          <NumberField
            label="Line width"
            suffix="px"
            min={1}
            max={200}
            value={el.stroke.width}
            onChange={(width) => update('stroke', (e) => ({ ...e, stroke: { ...e.stroke, width } }))}
          />
        </div>
        <div className={styles.rowGap}>
          <SegmentedControl
            label="Line style"
            options={[{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }]}
            value={el.stroke.dash}
            onChange={(dash) => update('dash', (e) => ({ ...e, stroke: { ...e.stroke, dash } }))}
          />
        </div>
      </section>
      <section>
        <h3 className={styles.heading}>Arrows</h3>
        <div className={styles.buttonRow}>
          <IconButton icon={MoveLeft} label="Arrow at start" pressed={el.start === 'arrow'} onClick={() => update('start', (e) => ({ ...e, start: e.start === 'arrow' ? 'none' : 'arrow' }))} />
          <IconButton icon={MoveRight} label="Arrow at end" pressed={el.end === 'arrow'} onClick={() => update('end', (e) => ({ ...e, end: e.end === 'arrow' ? 'none' : 'arrow' }))} />
        </div>
      </section>
    </>
  )
}

function ImageStyle({ slideId, el }: { slideId: string; el: ImageEl }) {
  const update = useUpdate(slideId, el)
  return (
    <>
      <section>
        <h3 className={styles.heading}>Image</h3>
        <SegmentedControl
          label="Image fit"
          options={[{ value: 'fill', label: 'Fill' }, { value: 'fit', label: 'Fit' }]}
          value={el.fit}
          onChange={(fit) => update('fit', (e) => ({ ...e, fit }))}
        />
        <p className={styles.swatchNote}>{el.fit === 'fill' ? 'Fills the box; the edges may be cut off' : 'Shows the whole picture inside the box'}</p>
      </section>
      <section>
        <h3 className={styles.heading}>Corners</h3>
        <NumberField label="Corner radius" suffix="px" min={0} max={2000} value={Math.round(el.radius)} onChange={(radius) => update('radius', (e) => ({ ...e, radius }))} />
      </section>
      <Effects slideId={slideId} el={el} />
    </>
  )
}

function LogoStyle({ slide, el }: { slide: Slide; el: LogoEl }) {
  const store = useEditorStore()
  const theme = useEditor((st) => st.deck.theme)
  const openDeckTheme = useOpenDeckTheme()
  return (
    <section>
      <h3 className={styles.heading}>Brand logo</h3>
      <div className={styles.logoRow}>
        <span className={styles.badge}>Follows theme</span>
        {logoAssetFor(theme, slide) ? (
          <Button variant="secondary" size="sm" icon={Unlink} onClick={() => store.apply((d) => detachLogo(d, slide.id, el.id))}>
            Detach
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={openDeckTheme}>
            Add a logo to the theme
          </Button>
        )}
      </div>
    </section>
  )
}

function IconStyle({ slideId, el }: { slideId: string; el: IconEl }) {
  const update = useUpdate(slideId, el)
  return (
    <section>
      <h3 className={styles.heading}>Icon</h3>
      <div className={styles.grid2}>
        <ColorButton variant="field" label="Icon color" value={el.color} onChange={(color) => color && update('color', (e) => ({ ...e, color }))} />
        <NumberField
          label="Line weight"
          min={0.5}
          max={4}
          step={0.25}
          value={el.strokeWidth}
          onChange={(strokeWidth) => update('strokeWidth', (e) => ({ ...e, strokeWidth }))}
        />
      </div>
    </section>
  )
}
