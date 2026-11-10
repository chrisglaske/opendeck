import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { BUILTIN_THEMES } from '../model/builtinThemes'
import styles from './Hero.module.css'

/** One chip per built-in theme. A single-choice group: arrow keys move and select, wrapping at the ends. */
export function ThemeChips({ value, onChange }: { value: string; onChange(id: string): void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + BUILTIN_THEMES.length) % BUILTIN_THEMES.length
    onChange(BUILTIN_THEMES[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Try a theme" className={styles.chipList}>
      {BUILTIN_THEMES.map((t, i) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={styles.chip}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <i
              className={styles.swatch}
              aria-hidden
              style={{ background: `linear-gradient(135deg, ${t.colors.bg} 50%, ${t.colors.accent} 50%)` }}
            />
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
