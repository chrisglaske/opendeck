import { Check, ChevronDown } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { themeVars } from '../../model/theme'
import type { FontRef } from '../../model/types'
import { Popover } from '../../ui'
import { useEditor } from '../EditorContext'
import s from './Pickers.module.css'

const ROLES: { font: FontRef; role: string }[] = [
  { font: 'heading', role: 'Heading' },
  { font: 'body', role: 'Body' },
]

/**
 * The theme's two fonts, by role, so text follows the theme if its fonts
 * change later. More fonts arrive with themes.
 */
export function FontMenu({ value, onChange, onClosed }: { value: FontRef; onChange(f: FontRef): void; onClosed?: () => void }) {
  const theme = useEditor((st) => st.deck.theme)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const items = useRef<(HTMLDivElement | null)[]>([])
  const name = theme.fonts[value]

  const close = () => {
    setOpen(false)
    if (onClosed) onClosed()
    else anchor?.focus()
  }
  const choose = (f: FontRef) => {
    onChange(f)
    close()
  }
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const move = (to: number) => {
      e.preventDefault()
      items.current[(to + ROLES.length) % ROLES.length]?.focus()
    }
    if (e.key === 'ArrowDown') move(i + 1)
    else if (e.key === 'ArrowUp') move(i - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(ROLES.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(ROLES[i].font)
    } else if (e.key === 'Tab') close()
  }

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={s.qfield}
        aria-label={`Font: ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className={s.qfieldText}>{name}</span>
        <ChevronDown size={13} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <Popover anchor={anchor} label="Font" role="menu" onClose={close} className={s.fontMenu} style={themeVars(theme)}>
          <div className={s.grp} aria-hidden>Theme fonts</div>
          {ROLES.map((r, i) => (
            <div
              key={r.font}
              ref={(n) => {
                items.current[i] = n
              }}
              role="menuitemradio"
              aria-checked={r.font === value}
              tabIndex={-1}
              data-autofocus={r.font === value ? '' : undefined}
              className={s.fontItem}
              onClick={() => choose(r.font)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span>
                <span className={r.font === 'heading' ? s.fontHeading : s.fontBody}>{theme.fonts[r.font]}</span>
                <span className={s.sub}>{r.role}</span>
              </span>
              {r.font === value && <Check size={15} strokeWidth={2} className={s.check} aria-hidden />}
            </div>
          ))}
          <hr className={s.menuSep} />
          <div className={s.menuNote}>More fonts come with themes</div>
        </Popover>
      )}
    </>
  )
}
