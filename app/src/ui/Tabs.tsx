import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { nextIndex } from './rovingKeys'
import styles from './Tabs.module.css'

const tabId = (base: string, id: string) => `${base}-tab-${id}`
const panelId = (base: string, id: string) => `${base}-panel-${id}`

/**
 * A tab list. Pass the same `id` to the `TabPanel` that shows the selected tab's
 * content so the two are linked for assistive tech.
 */
export function Tabs({
  label,
  tabs,
  value,
  onChange,
  id,
  className,
}: {
  label: string
  tabs: { id: string; label: string }[]
  value: string
  onChange(id: string): void
  id?: string
  className?: string
}) {
  const auto = useId()
  const base = id ?? auto
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const next = nextIndex(e.key, index, tabs.length)
    if (next === null || e.key === 'ArrowUp' || e.key === 'ArrowDown') return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(tabs[next].id)
  }

  return (
    <div role="tablist" aria-label={label} className={[styles.tabs, className].filter(Boolean).join(' ')}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          id={tabId(base, t.id)}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          // Only the selected tab's panel is in the document.
          aria-controls={id && t.id === value ? panelId(base, t.id) : undefined}
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

/** The content of the selected tab. `id` matches the `Tabs` id, `tab` the selected tab. */
export function TabPanel({ id, tab, className, children }: { id: string; tab: string; className?: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={panelId(id, tab)} aria-labelledby={tabId(id, tab)} className={className}>
      {children}
    </div>
  )
}
