import type { LucideIcon } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { nextIndex } from './rovingKeys'
import styles from './SegmentedControl.module.css'

/** With `iconOnly`, the label is the option's name for screen readers and its tooltip, not shown. */
export type SegmentedOption<T extends string> = { value: T; label: string; icon?: LucideIcon; iconOnly?: boolean }

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange(v: T): void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = Math.max(0, options.findIndex((o) => o.value === value))

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const next = nextIndex(e.key, index, options.length)
    if (next === null) return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(options[next].value)
  }

  return (
    <div role="radiogroup" aria-label={label} className={styles.seg}>
      {options.map((o, i) => {
        const Icon = o.icon
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={i === selected && o.value === value}
            tabIndex={i === selected ? 0 : -1}
            className={[styles.option, o.iconOnly && styles.iconOnly].filter(Boolean).join(' ')}
            aria-label={o.iconOnly ? o.label : undefined}
            title={o.iconOnly ? o.label : undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
            {!o.iconOnly && o.label}
          </button>
        )
      })}
    </div>
  )
}
