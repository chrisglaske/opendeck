import { Pipette, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { resolveColor, themeVars } from '../../model/theme'
import type { Theme } from '../../model/theme'
import type { ColorRef } from '../../model/types'
import { IconButton, Popover } from '../../ui'
import { useEditor } from '../EditorContext'
import { customColors, hexToHsv, hsvToHex, normalizeHex, THEME_COLORS, themeColorName } from './color'
import type { Hsv } from './color'
import s from './Pickers.module.css'

type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> }
const eyeDropper = (): EyeDropperCtor | undefined => (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper

const sameColor = (a: ColorRef | null, b: ColorRef | null) =>
  a === null || b === null ? a === b : 'theme' in a ? 'theme' in b && a.theme === b.theme : 'hex' in b && a.hex.toUpperCase() === b.hex.toUpperCase()

/** A color's name for labels: the theme name, the hex code, or the "none" label. */
export function colorLabel(c: ColorRef | null, none = 'None'): string {
  if (!c) return none
  return 'theme' in c ? themeColorName(c.theme) : c.hex.toUpperCase()
}

/** The hex value a theme color has in this deck (accent tint is mixed, so it starts from the accent). */
function hexOf(c: ColorRef | null, theme: Theme): string {
  if (!c) return theme.colors.text
  if ('hex' in c) return normalizeHex(c.hex) ?? '#000000'
  return c.theme === 'accentTint' ? theme.colors.accent : theme.colors[c.theme]
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export type ColorPickerProps = {
  value: ColorRef | null
  onChange(c: ColorRef | null): void
  /** Offers "no color" (shape fill and border). */
  allowNone?: boolean
  noneLabel?: string
  /** Opens with the mixer showing. */
  startMixing?: boolean
}

/** Theme colors first (they follow the theme), then this deck's custom colors and a mixer. */
export function ColorPicker({ value, onChange, allowNone = false, noneLabel = 'None', startMixing = false }: ColorPickerProps) {
  const deck = useEditor((st) => st.deck)
  const theme = deck.theme
  const customs = customColors(deck)
  const current = value && 'hex' in value ? normalizeHex(value.hex) : null
  const shown = current && !customs.includes(current) ? [current, ...customs].slice(0, 10) : customs
  const [mixing, setMixing] = useState(startMixing || current !== null)
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(hexOf(value, theme)))

  const pickHsv = (next: Hsv) => {
    setHsv(next)
    onChange({ hex: hsvToHex(next) })
  }

  return (
    <div className={s.picker} style={themeVars(theme)}>
      <div className={s.ph}>
        Theme colors <em>Follow the theme</em>
      </div>
      <div className={s.swatches}>
        {allowNone && (
          <button
            type="button"
            className={`${s.sw} ${s.none}`}
            aria-label={noneLabel}
            title={noneLabel}
            aria-pressed={value === null}
            data-autofocus={value === null ? '' : undefined}
            onClick={() => onChange(null)}
          />
        )}
        {THEME_COLORS.map((c) => {
          const ref: ColorRef = { theme: c.token }
          const on = sameColor(value, ref)
          return (
            <button
              key={c.token}
              type="button"
              className={s.sw}
              aria-label={c.name}
              title={c.name}
              aria-pressed={on}
              data-autofocus={on ? '' : undefined}
              style={{ backgroundColor: resolveColor(ref) }}
              onClick={() => onChange(ref)}
            />
          )
        })}
      </div>

      <div className={`${s.ph} ${s.gap}`}>
        Custom <em>This deck</em>
      </div>
      <div className={s.swatches}>
        {shown.map((hex) => (
          <button
            key={hex}
            type="button"
            className={s.sw}
            aria-label={hex}
            title={hex}
            aria-pressed={current === hex}
            data-autofocus={current === hex ? '' : undefined}
            style={{ backgroundColor: hex }}
            onClick={() => {
              setHsv(hexToHsv(hex))
              onChange({ hex })
            }}
          />
        ))}
        <button
          type="button"
          className={`${s.sw} ${s.add}`}
          aria-label="Mix a custom color"
          title="Mix a custom color"
          aria-expanded={mixing}
          onClick={() => setMixing(true)}
        >
          <Plus size={12} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {shown.length === 0 && !mixing && <p className={s.hint}>No custom colors yet. Press + to mix one.</p>}

      {mixing && <Mixer hsv={hsv} onPick={pickHsv} />}
    </div>
  )
}

/** Shade square, hue bar and hex field. */
function Mixer({ hsv, onPick }: { hsv: Hsv; onPick(c: Hsv): void }) {
  const hex = hsvToHex(hsv)
  const [draft, setDraft] = useState<string | null>(null)
  const invalid = draft !== null && normalizeHex(draft) === null
  const Dropper = eyeDropper()

  const commitDraft = () => {
    if (draft === null) return
    const h = normalizeHex(draft)
    setDraft(null)
    if (h && h !== hex) onPick(hexToHsv(h))
  }

  const onHexKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitDraft()
    else if (e.key === 'Escape' && draft !== null) {
      e.preventDefault()
      e.stopPropagation()
      setDraft(null)
    }
  }

  return (
    <div className={s.mixer}>
      <div className={s.hr} />
      <Area2D hsv={hsv} onPick={onPick} />
      <HueBar hsv={hsv} onPick={onPick} />
      <div className={s.hexRow}>
        <label className={s.hexField} data-invalid={invalid || undefined}>
          <span className={s.pre} aria-hidden>#</span>
          <input
            aria-label="Hex color"
            aria-invalid={invalid}
            className={s.hexInput}
            spellCheck={false}
            maxLength={7}
            value={draft ?? hex.slice(1)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onHexKey}
            onBlur={commitDraft}
          />
        </label>
        {Dropper && (
          <IconButton
            icon={Pipette}
            label="Pick from screen"
            size="sm"
            onClick={() => {
              new Dropper().open().then(
                (r) => {
                  const h = normalizeHex(r.sRGBHex)
                  if (h) onPick(hexToHsv(h))
                },
                () => {},
              )
            }}
          />
        )}
      </div>
    </div>
  )
}

/** Follows a pointer drag over `el`, reporting the position as 0..1 fractions. */
function trackPointer(e: ReactPointerEvent<HTMLElement>, fn: (fx: number, fy: number) => void) {
  const el = e.currentTarget
  const report = (ev: { clientX: number; clientY: number }) => {
    const r = el.getBoundingClientRect()
    fn(clamp01((ev.clientX - r.left) / (r.width || 1)), clamp01((ev.clientY - r.top) / (r.height || 1)))
  }
  e.preventDefault()
  el.focus()
  el.setPointerCapture?.(e.pointerId)
  report(e)
  const move = (ev: PointerEvent) => report(ev)
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

function Area2D({ hsv, onPick }: { hsv: Hsv; onPick(c: Hsv): void }) {
  const latest = useRef(hsv)
  latest.current = hsv
  const onKey = (e: KeyboardEvent) => {
    const d = e.shiftKey ? 0.1 : 0.02
    const { s: sat, v } = latest.current
    const next =
      e.key === 'ArrowLeft' ? { s: sat - d, v } : e.key === 'ArrowRight' ? { s: sat + d, v } :
      e.key === 'ArrowUp' ? { s: sat, v: v + d } : e.key === 'ArrowDown' ? { s: sat, v: v - d } : null
    if (!next) return
    e.preventDefault()
    onPick({ h: latest.current.h, s: clamp01(next.s), v: clamp01(next.v) })
  }
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Shade"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.s * 100)}
      aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      className={s.area}
      style={{ ['--hue' as string]: String(Math.round(hsv.h)) }}
      onPointerDown={(e) => trackPointer(e, (fx, fy) => onPick({ h: latest.current.h, s: fx, v: 1 - fy }))}
      onKeyDown={onKey}
    >
      <span className={s.knob} style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
    </div>
  )
}

function HueBar({ hsv, onPick }: { hsv: Hsv; onPick(c: Hsv): void }) {
  const latest = useRef(hsv)
  latest.current = hsv
  const onKey = (e: KeyboardEvent) => {
    const d = e.shiftKey ? 10 : 2
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    onPick({ ...latest.current, h: Math.min(359, Math.max(0, latest.current.h + dir * d)) })
  }
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(hsv.h)}
      className={s.hue}
      onPointerDown={(e) => trackPointer(e, (fx) => onPick({ ...latest.current, h: Math.min(359, fx * 360) }))}
      onKeyDown={onKey}
    >
      <span className={s.knob} style={{ left: `${(hsv.h / 360) * 100}%` }} />
    </div>
  )
}

/**
 * A color control that opens the picker: a round dot for quick bars, or a
 * swatch with the color's name for the panel.
 */
export function ColorButton({
  label,
  value,
  onChange,
  allowNone,
  noneLabel,
  variant = 'dot',
  onClosed,
}: Omit<ColorPickerProps, 'startMixing'> & {
  /** What the color is for, e.g. "Text color"; the current color is added to the name. */
  label: string
  /** `add` is the "+" swatch that opens the mixer. */
  variant?: 'dot' | 'field' | 'add'
  /** Called after the picker closes, instead of returning focus to the button. */
  onClosed?: () => void
}) {
  const theme = useEditor((st) => st.deck.theme)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const name = colorLabel(value, noneLabel)
  const close = () => {
    setOpen(false)
    if (onClosed) onClosed()
    else anchor?.focus()
  }
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={variant === 'dot' ? s.dot : variant === 'add' ? `${s.sw} ${s.add}` : s.colorField}
        aria-label={variant === 'add' ? label : `${label}: ${name}`}
        title={variant === 'field' ? undefined : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={themeVars(theme)}
        // Keep the text selection while the picker opens from a quick bar.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {variant === 'add' ? (
          <Plus size={12} strokeWidth={2} aria-hidden />
        ) : (
          <span
            className={`${s.chip} ${value ? '' : s.none}`}
            style={{ backgroundColor: value ? resolveColor(value) : undefined }}
            aria-hidden
          />
        )}
        {variant === 'field' && <span className={s.colorName}>{name}</span>}
      </button>
      {open && (
        <Popover anchor={anchor} label={label} onClose={close} className={s.popover}>
          <ColorPicker value={value} onChange={onChange} allowNone={allowNone} noneLabel={noneLabel} startMixing={variant === 'add'} />
        </Popover>
      )}
    </>
  )
}
