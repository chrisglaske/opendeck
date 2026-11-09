import { BookmarkPlus, ChevronDown, ChevronRight, RotateCcw, TriangleAlert } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { BrandKit } from '../../model/brandKit'
import { builtinTheme, CORNER_PRESETS } from '../../model/builtinThemes'
import { SAMPLE_SLIDES } from '../../model/sampleSlides'
import type { Theme } from '../../model/theme'
import { deriveColors, issueLabel, readabilityIssues } from '../../model/themeColors'
import { applyTheme, isDarkHex, themeFromKit } from '../../model/themeOps'
import { SLIDE_W } from '../../model/types'
import type { DerivedColor, MainColor } from '../../model/types'
import { SlideView } from '../../render/SlideView'
import { getDeckStore } from '../../storage/appStore'
import { brandKit, saveKit } from '../../storage/kits'
import { Button, Checkbox, LargeDialog, TextField, toast } from '../../ui'
import { nextIndex } from '../../ui/rovingKeys'
import { exitTextEditing } from '../canvas/textSession'
import { useEditor, useEditorStore } from '../EditorContext'
import { FontPicker } from '../pickers/FontPicker'
import { SAVE_ERROR_TEXT } from '../SaveStatus'
import { ColorRow } from './ColorRow'
import { LogoSlot } from './LogoSlot'
import styles from './BrandKitDialog.module.css'

const MAIN: { token: MainColor; name: string }[] = [
  { token: 'bg', name: 'Background' },
  { token: 'surface', name: 'Surface' },
  { token: 'text', name: 'Text' },
  { token: 'accent', name: 'Accent' },
  { token: 'accent2', name: 'Second accent' },
]
const DERIVED: { token: DerivedColor; name: string }[] = [
  { token: 'muted', name: 'Muted text' },
  { token: 'accentText', name: 'Accent text' },
  { token: 'onAccent', name: 'Text on accent' },
  { token: 'line', name: 'Lines' },
]
const isMain = (t: string): t is MainColor => MAIN.some((m) => m.token === t)

/** How round each corner tile's sample is drawn, in screen pixels. */
const CORNER_SAMPLE: Record<(typeof CORNER_PRESETS)[number]['id'], number> = { square: 0, slight: 4, soft: 9, round: 14 }

/** The theme this deck's theme came from, as it is now; undefined when it no longer exists. */
function sourceTheme(t: Theme): Theme | undefined {
  const src = t.source
  if (!src) return undefined
  if (src.kind === 'builtin') return builtinTheme(src.id)
  const kit = brandKit(src.id)
  return kit ? themeFromKit(kit) : undefined
}

function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setW(el.clientWidth || fallback)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fallback])
  return [ref, w] as const
}

/** The same sample slides every time, drawn with the draft theme. */
function Preview({ theme }: { theme: Theme }) {
  const [ref, w] = useWidth(720)
  const gap = 14
  const big = w / SLIDE_W
  const small = (w - gap) / 2 / SLIDE_W
  return (
    <section className={styles.preview} aria-label="Preview">
      <div ref={ref} className={styles.previewGrid}>
        <div className={styles.previewBig}>
          <div className={styles.previewSlide} style={{ width: `${w}px`, height: `${(w * 9) / 16}px` }}>
            <SlideView slide={SAMPLE_SLIDES.title} theme={theme} scale={big} interactive={false} />
          </div>
        </div>
        {[SAMPLE_SLIDES.bullets, SAMPLE_SLIDES.stats].map((s) => (
          <div key={s.id} className={styles.previewSlide} style={{ width: `${(w - gap) / 2}px`, height: `${((w - gap) / 2) * (9 / 16)}px` }}>
            <SlideView slide={s} theme={theme} scale={small} interactive={false} />
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Creates or edits a brand kit, or customizes this deck's theme. Settings on the left,
 * a live preview on the right. Nothing changes until it is saved or Done is pressed.
 */
export function BrandKitDialog({ mode, start, kit, onClose }: { mode: 'new' | 'edit' | 'deck'; start: Theme; kit?: BrandKit; onClose(): void }) {
  const store = useEditorStore()
  const deckName = useEditor((s) => s.deck.name)
  const [draft, setDraft] = useState<Theme>(() => structuredClone(start))
  const [name, setName] = useState(mode === 'edit' ? start.name : '')
  const [apply, setApply] = useState(true)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)

  const c = draft.colors
  const issues = readabilityIssues(c, draft.manualColors)
  const main = { bg: c.bg, surface: c.surface, text: c.text, accent: c.accent, accent2: c.accent2 }
  const reset = mode === 'deck' ? sourceTheme(start) : undefined
  const trimmed = name.trim()

  const setMain = (token: MainColor, hex: string) =>
    setDraft((d) => ({ ...d, colors: deriveColors({ ...pickMain(d), [token]: hex }, d.colors, d.manualColors) }))
  const setDerived = (token: DerivedColor, hex: string) =>
    setDraft((d) => ({
      ...d,
      colors: { ...d.colors, [token]: hex },
      manualColors: d.manualColors.includes(token) ? d.manualColors : [...d.manualColors, token],
    }))
  const setAuto = (token: DerivedColor) =>
    setDraft((d) => {
      const manualColors = d.manualColors.filter((x) => x !== token)
      return { ...d, manualColors, colors: deriveColors(pickMain(d), d.colors, manualColors) }
    })
  const setColor = (token: MainColor | DerivedColor, hex: string) => (isMain(token) ? setMain(token, hex) : setDerived(token, hex))

  /** Applies a theme to the deck as one undo step, ending any text edit first. */
  const applyToDeck = (t: Theme) => {
    exitTextEditing(store)
    store.apply((d) => applyTheme(d, t))
  }

  const saveAsKit = async (theme: Theme, id: string | undefined, andApply: boolean) => {
    setBusy(true)
    const r = await saveKit(await getDeckStore(), theme, id)
    if (andApply) applyToDeck(themeFromKit(r.kit))
    toast(r.notSaved ? `Brand kit kept for this tab, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}` : 'Brand kit saved', r.notSaved ? { durationMs: 8000 } : {})
    onClose()
  }

  const done = () => {
    if (JSON.stringify(draft) !== JSON.stringify(start)) applyToDeck(draft)
    onClose()
  }

  const title = mode === 'new' ? 'New brand kit' : mode === 'edit' ? 'Edit brand kit' : "This deck's theme"
  const hint = mode === 'new' ? `Starts from ${start.name}` : mode === 'deck' ? `Changes apply to ${deckName} only` : undefined
  const corner = CORNER_PRESETS.find((p) => p.px === draft.radius)?.id
  const cornersId = useId()
  const cornerRefs = useRef<(HTMLButtonElement | null)[]>([])
  const onCornerKey = (e: KeyboardEvent, i: number) => {
    const next = nextIndex(e.key, i, CORNER_PRESETS.length)
    if (next === null) return
    e.preventDefault()
    cornerRefs.current[next]?.focus()
    setDraft((d) => ({ ...d, radius: CORNER_PRESETS[next].px }))
  }

  const footer =
    mode === 'deck' ? (
      <>
        <Button variant="ghost" icon={RotateCcw} disabled={!reset} onClick={() => reset && setDraft({ ...structuredClone(reset), source: start.source })}>
          {start.source ? `Reset to ${start.source.name}` : 'Reset'}
        </Button>
        <span className={styles.spacer} />
        <Button variant="secondary" icon={BookmarkPlus} disabled={busy} onClick={() => void saveAsKit(draft, undefined, true)}>
          Save as brand kit
        </Button>
        <Button variant="primary" onClick={done}>
          Done
        </Button>
      </>
    ) : (
      <>
        <Checkbox checked={apply} onChange={setApply} label="Apply to this deck" />
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!trimmed || busy} onClick={() => void saveAsKit({ ...draft, name: trimmed }, kit?.id, apply)}>
          Save brand kit
        </Button>
      </>
    )

  return (
    <LargeDialog onClose={onClose} title={title} hint={hint} footer={footer}>
      <div className={styles.body}>
        <div className={styles.form}>
          {mode !== 'deck' && <TextField label="Name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}

          <section>
            <h4 className={styles.label}>
              Logo <em>PNG, JPG or WebP</em>
            </h4>
            <div className={styles.logos}>
              <LogoSlot caption="Main logo" assetId={draft.logo.main} background={c.bg} dark={isDarkHex(c.bg)} onChange={(id) => setDraft((d) => ({ ...d, logo: { ...d.logo, main: id } }))} />
              <LogoSlot
                caption="For dark backgrounds (optional)"
                assetId={draft.logo.dark}
                background={isDarkHex(c.text) ? c.text : '#1C1B2A'}
                dark
                onChange={(id) => setDraft((d) => ({ ...d, logo: { ...d.logo, dark: id } }))}
              />
            </div>
          </section>

          <section>
            <h4 className={styles.label}>Colors</h4>
            {MAIN.map((m) => (
              <ColorRow key={m.token} name={m.name} hex={main[m.token]} onChange={(hex) => setMain(m.token, hex)} />
            ))}
            {issues.map((i) => (
              <div key={`${i.fg}-${i.bg}`} className={styles.warn}>
                <TriangleAlert size={15} strokeWidth={1.75} aria-hidden />
                <span>
                  <b>{issueLabel(i, c)}</b>, hard to read in small sizes (needs 4.5:1).{' '}
                  <button type="button" className={styles.link} onClick={() => setColor(i.fix.token as MainColor | DerivedColor, i.fix.hex)}>
                    {i.fix.verb} to {i.fix.hex}
                  </button>
                </span>
              </div>
            ))}
            <button type="button" className={styles.more} aria-expanded={more} onClick={() => setMore(!more)}>
              {more ? <ChevronDown size={14} strokeWidth={1.75} aria-hidden /> : <ChevronRight size={14} strokeWidth={1.75} aria-hidden />}
              More colors <span className={styles.moreHint}>· set automatically</span>
            </button>
            {more &&
              DERIVED.map((d) => (
                <ColorRow
                  key={d.token}
                  name={d.name}
                  hex={c[d.token]}
                  onChange={(hex) => setDerived(d.token, hex)}
                  extra={
                    draft.manualColors.includes(d.token) ? (
                      <button type="button" className={styles.auto} aria-label={`Work out ${d.name} automatically`} onClick={() => setAuto(d.token)}>
                        Auto
                      </button>
                    ) : undefined
                  }
                />
              ))}
          </section>

          <section>
            <h4 className={styles.label}>Fonts</h4>
            <div className={styles.fontRow}>
              <span className={styles.fontLabel}>Headings</span>
              <FontPicker
                variant="field"
                label="Headings"
                value={draft.fonts.heading}
                inUse={[draft.fonts.heading, draft.fonts.body]}
                onPick={(f) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, heading: f } }))}
              />
            </div>
            <div className={styles.fontRow}>
              <span className={styles.fontLabel}>Body</span>
              <FontPicker
                variant="field"
                label="Body"
                value={draft.fonts.body}
                inUse={[draft.fonts.heading, draft.fonts.body]}
                onPick={(f) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, body: f } }))}
              />
            </div>
          </section>

          <section>
            <h4 className={styles.label} id={cornersId}>
              Corners
            </h4>
            <div className={styles.corners} role="radiogroup" aria-labelledby={cornersId}>
              {CORNER_PRESETS.map((p, i) => (
                <button
                  key={p.id}
                  ref={(el) => {
                    cornerRefs.current[i] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={corner === p.id}
                  tabIndex={corner === p.id || (!corner && i === 0) ? 0 : -1}
                  className={styles.corner}
                  onKeyDown={(e) => onCornerKey(e, i)}
                  onClick={() => setDraft((d) => ({ ...d, radius: p.px }))}
                >
                  <i style={{ borderTopLeftRadius: `${CORNER_SAMPLE[p.id]}px` }} aria-hidden />
                  {p.label}
                </button>
              ))}
            </div>
          </section>
        </div>
        <Preview theme={draft} />
      </div>
    </LargeDialog>
  )
}

function pickMain(t: Theme): Record<MainColor, string> {
  const { bg, surface, text, accent, accent2 } = t.colors
  return { bg, surface, text, accent, accent2 }
}
