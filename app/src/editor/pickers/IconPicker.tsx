import { Search, SearchX, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ICON_CATEGORIES, ICON_SET } from './iconSet'
import s from './IconPicker.module.css'

const COLS = 8
const human = (name: string) => name.replace(/-/g, ' ')

/** Groups of icons whose name or category matches the search. */
export function searchIcons(query: string): { label: string; names: string[] }[] {
  const q = query.trim().toLowerCase()
  if (!q) return ICON_CATEGORIES
  return ICON_CATEGORIES.map((c) => ({
    label: c.label,
    names: c.label.toLowerCase().includes(q) ? c.names : c.names.filter((n) => human(n).includes(q) || n.includes(q)),
  })).filter((c) => c.names.length > 0)
}

/**
 * Browse or search the icon set. Category chips jump to a group; the arrow
 * keys move through the grid. The current icon (when replacing) is outlined.
 */
export function IconPicker({ value, onPick }: { value?: string; onPick(name: string): void }) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => searchIcons(query), [query])
  const flat = groups.flatMap((g) => g.names)
  const [active, setActive] = useState(() => Math.max(0, value ? flat.indexOf(value) : 0))
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const heads = useRef(new Map<string, HTMLElement>())
  const current = Math.min(active, Math.max(0, flat.length - 1))

  const focusAt = (i: number) => {
    const next = Math.max(0, Math.min(flat.length - 1, i))
    setActive(next)
    buttons.current.get(flat[next])?.focus()
  }

  const onGridKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }
    if (e.key in step) focusAt(current + step[e.key])
    else if (e.key === 'Home') focusAt(0)
    else if (e.key === 'End') focusAt(flat.length - 1)
    else return
    e.preventDefault()
  }

  return (
    <div className={s.picker}>
      <div className={s.head}>
        <label className={s.search}>
          <Search size={14} strokeWidth={1.75} aria-hidden />
          <input
            data-autofocus=""
            aria-label="Search icons"
            placeholder="Search icons"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && flat.length) {
                e.preventDefault()
                focusAt(0)
              } else if (e.key === 'Enter' && flat.length) {
                e.preventDefault()
                onPick(flat[0])
              }
            }}
          />
          {query && (
            <button type="button" className={s.clear} aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={14} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </label>
        {!query && (
          <div className={s.chips}>
            {ICON_CATEGORIES.map((c) => (
              <button
                key={c.label}
                type="button"
                className={s.chip}
                onClick={() => heads.current.get(c.label)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={s.body} onKeyDown={onGridKey}>
        {flat.length === 0 ? (
          <div className={s.empty}>
            <SearchX size={20} strokeWidth={1.75} aria-hidden />
            <b>No icons match “{query.trim()}”</b>
            <span>Try a simpler word, like chart, money or person.</span>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div
                className={s.cat}
                aria-hidden
                ref={(n) => {
                  if (n) heads.current.set(g.label, n)
                }}
              >
                {g.label}
              </div>
              <div className={s.grid}>
                {g.names.map((name) => {
                  const Icon = ICON_SET[name]
                  const i = flat.indexOf(name)
                  return (
                    <button
                      key={name}
                      ref={(n) => {
                        if (n) buttons.current.set(name, n)
                        else buttons.current.delete(name)
                      }}
                      type="button"
                      className={s.icon}
                      aria-label={human(name)}
                      title={human(name)}
                      aria-pressed={value === name}
                      tabIndex={i === current ? 0 : -1}
                      onFocus={() => setActive(i)}
                      onClick={() => onPick(name)}
                    >
                      {Icon && <Icon size={18} strokeWidth={1.75} aria-hidden />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <div className={s.foot}>
        <span>{flat.length} icons</span>
        <span>Lucide</span>
      </div>
    </div>
  )
}
