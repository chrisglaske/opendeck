import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Field.module.css'

export type NumberFieldProps = {
  label: string
  value: number
  onChange(v: number): void
  min?: number
  max?: number
  step?: number
  /** Short visible prefix such as "X" or an icon; the full label stays the accessible name. */
  prefix?: ReactNode
  /** Visible unit after the number, such as "°" or "px". */
  suffix?: string
  size?: 'md' | 'sm'
  className?: string
}

const tidy = (n: number) => Number(n.toFixed(6))

/** Reads a typed number; a comma works as the decimal separator. */
function parse(text: string): number {
  const t = text.trim().replace(',', '.')
  return t === '' ? NaN : Number(t)
}

export function NumberField({ label, value, onChange, min, max, step = 1, prefix, suffix, size = 'md', className }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const dirty = useRef(false)

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))

  const commit = (n: number) => {
    const next = tidy(clamp(n))
    dirty.current = false
    setDraft(null)
    if (next !== value) onChange(next)
  }

  const commitDraft = () => {
    if (!dirty.current || draft === null) return setDraft(null)
    const parsed = parse(draft)
    if (Number.isFinite(parsed)) commit(parsed)
    else {
      dirty.current = false
      setDraft(null)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = (e.shiftKey ? step * 10 : step) * (e.key === 'ArrowUp' ? 1 : -1)
      // Step from what is typed, so "40" then ↑ gives 41 even before Enter.
      const typed = dirty.current && draft !== null ? parse(draft) : NaN
      commit((Number.isFinite(typed) ? typed : value) + delta)
    } else if (e.key === 'Enter') {
      commitDraft()
    } else if (e.key === 'Escape') {
      // Esc belongs to the field: it must not also clear the canvas selection.
      e.preventDefault()
      e.stopPropagation()
      dirty.current = false
      setDraft(null)
    }
  }

  return (
    <div className={[styles.field, size === 'sm' ? styles.sm : '', className].filter(Boolean).join(' ')}>
      {prefix && (
        <span className={styles.prefix} aria-hidden>
          {prefix}
        </span>
      )}
      <input
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        inputMode="decimal"
        className={`${styles.input} ${styles.numeric}`}
        value={draft ?? String(value)}
        onChange={(e) => {
          dirty.current = true
          setDraft(e.target.value)
        }}
        onKeyDown={onKeyDown}
        onBlur={commitDraft}
      />
      {suffix && (
        <span className={styles.suffix} aria-hidden>
          {suffix}
        </span>
      )}
    </div>
  )
}
