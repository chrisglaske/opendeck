import { useId, useRef, type KeyboardEvent } from 'react'
import { nextIndex } from './rovingKeys'
import styles from './Tabs.module.css'

export function Tabs({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string
  tabs: { id: string; label: string }[]
  value: string
  onChange(id: string): void
}) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const next = nextIndex(e.key, index, tabs.length)
    if (next === null || e.key === 'ArrowUp' || e.key === 'ArrowDown') return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(tabs[next].id)
  }

  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          id={`${base}-${t.id}`}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          className={styles.tab}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
