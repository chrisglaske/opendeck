import { useId, useRef, useState, type KeyboardEvent } from 'react'
import styles from './Field.module.css'

export type NumberFieldProps = {
  label: string
  value: number
  onChange(v: number): void
  min?: number
  max?: number
  step?: number
  /** Short visible prefix such as "X" or "W"; the full label stays the accessible name. */
  prefix?: string
}

const tidy = (n: number) => Number(n.toFixed(6))

export function NumberField({ label, value, onChange, min, max, step = 1, prefix }: NumberFieldProps) {
  const id = useId()
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
    const parsed = draft.trim() === '' ? NaN : Number(draft)
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
      commit(value + delta)
    } else if (e.key === 'Enter') {
      commitDraft()
    } else if (e.key === 'Escape') {
      dirty.current = false
      setDraft(null)
    }
  }

  return (
    <div className={styles.field}>
      {prefix && (
        <span className={styles.prefix} aria-hidden>
          {prefix}
        </span>
      )}
      <input
        id={id}
        aria-label={label}
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
    </div>
  )
}
