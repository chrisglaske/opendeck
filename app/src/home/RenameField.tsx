import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import styles from './RenameField.module.css'

/** Renames in place: Enter (or leaving the field) saves, Esc cancels. */
export function RenameField({
  name, label, maxLength, className, onDone,
}: {
  name: string
  label: string
  maxLength: number
  className?: string
  onDone(name: string | null): void
}) {
  const done = useRef(false)
  const finish = (v: string | null) => {
    if (done.current) return
    done.current = true
    onDone(v)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      finish(e.currentTarget.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      finish(null)
    }
  }
  return (
    <input
      className={[styles.field, className].filter(Boolean).join(' ')}
      aria-label={label}
      defaultValue={name}
      maxLength={maxLength}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={onKeyDown}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  )
}
