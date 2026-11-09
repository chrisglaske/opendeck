import { Check, Plus, Tag } from 'lucide-react'
import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Popover } from '../ui'
import { normalizeTag, tagKey } from './library'
import styles from './TagsPopover.module.css'

/**
 * Tags for one deck: a field to find or add a tag, and every known tag as a row with a check.
 * Enter on the field creates the typed tag (or toggles it when it already exists).
 */
export function TagsPopover({
  anchor, deckName, tags, allTags, onChange, onClose,
}: {
  anchor: HTMLElement | null
  deckName: string
  /** The deck's tags. */
  tags: string[]
  /** Every tag in use, most used first. */
  allTags: string[]
  onChange(tags: string[]): void
  onClose(): void
}) {
  const id = useId()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(-1)
  const has = (t: string) => tags.some((x) => tagKey(x) === tagKey(t))
  const known = [...tags, ...allTags.filter((t) => !tags.some((x) => tagKey(x) === tagKey(t)))]
  const query = normalizeTag(q)
  const shown = query ? known.filter((t) => tagKey(t).includes(tagKey(query))) : known
  const exact = query ? known.find((t) => tagKey(t) === tagKey(query)) : undefined

  const toggle = (t: string) => onChange(has(t) ? tags.filter((x) => tagKey(x) !== tagKey(t)) : [...tags, t])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!shown.length) return
      const d = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (a < 0 ? (d > 0 ? 0 : shown.length - 1) : (a + d + shown.length) % shown.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && shown[active]) toggle(shown[active])
      else if (exact) toggle(exact)
      else if (query) {
        onChange([...tags, query])
        setQ('')
        setActive(-1)
      }
    }
  }

  return (
    <Popover anchor={anchor} label={`Tags for ${deckName}`} onClose={onClose} className={styles.pop}>
      <div className={styles.field}>
        <Tag size={14} strokeWidth={1.75} aria-hidden />
        <input
          data-autofocus=""
          role="combobox"
          aria-label="Add or find a tag"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
          placeholder="Add or find a tag"
          value={q}
          maxLength={60}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(-1)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div id={`${id}-list`} role="listbox" aria-label="Tags" aria-multiselectable="true" className={styles.list}>
        {shown.map((t, i) => (
          <div
            key={tagKey(t)}
            id={`${id}-${i}`}
            role="option"
            aria-selected={has(t)}
            className={[styles.row, i === active && styles.active].filter(Boolean).join(' ')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle(t)}
          >
            <span className={styles.name}>{t}</span>
            {has(t) && <Check size={16} strokeWidth={1.75} aria-hidden className={styles.check} />}
          </div>
        ))}
        {query && !exact && (
          <div className={styles.hint} aria-hidden>
            <Plus size={14} strokeWidth={1.75} />
            Press Enter to add “{query}”
          </div>
        )}
      </div>
    </Popover>
  )
}
