import { CircleAlert, Link, Unlink } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Popover } from '../../ui'
import { normalizeLink } from './link'
import s from './Pickers.module.css'

export const LINK_ERROR = 'Only web links (https://…) and email links (mailto:…) work in decks.'

/**
 * Edits the link on the selected words. Enter applies; a bare address gets
 * https:// added, and anything other than a web or email link is refused.
 */
export function LinkPopover({
  anchor,
  href,
  onApply,
  onRemove,
  onClose,
}: {
  anchor: HTMLElement | null
  /** The current link, if the words already have one. */
  href: string | null
  onApply(href: string): void
  onRemove(): void
  onClose(): void
}) {
  const [value, setValue] = useState(href ?? '')
  const [error, setError] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = normalizeLink(value)
    if (!next) return setError(true)
    onApply(next)
    onClose()
  }

  return (
    <Popover anchor={anchor} label="Link" onClose={onClose} className={s.linkPopover}>
      <form onSubmit={submit}>
        <label className={s.hexField} data-invalid={error || undefined}>
          <Link size={14} strokeWidth={1.75} className={s.fieldIcon} aria-hidden />
          <input
            data-autofocus=""
            aria-label="Link address"
            aria-invalid={error}
            aria-describedby={error ? 'link-error' : undefined}
            className={s.linkInput}
            placeholder="Paste or type a link"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(false)
            }}
          />
        </label>
        {error && (
          <p id="link-error" className={s.error} role="alert">
            <CircleAlert size={14} strokeWidth={1.75} aria-hidden />
            <span>{LINK_ERROR}</span>
          </p>
        )}
        <div className={s.linkActions}>
          {href ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={Unlink}
              onClick={() => {
                onRemove()
                onClose()
              }}
            >
              Remove link
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" variant="primary">
            Apply
          </Button>
        </div>
      </form>
    </Popover>
  )
}
