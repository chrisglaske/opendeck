import type { LucideIcon } from 'lucide-react'
import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react'
import styles from './Menu.module.css'

export type MenuItem =
  | {
      id: string
      label: string
      icon?: LucideIcon
      shortcut?: string
      danger?: boolean
      onSelect(): void
    }
  | 'separator'

type TriggerProps = {
  onClick?: (e: MouseEvent<HTMLElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void
  'aria-haspopup'?: 'menu'
  'aria-expanded'?: boolean
  'aria-controls'?: string
}

export function Menu({
  trigger,
  items,
  label,
}: {
  trigger: ReactElement<TriggerProps>
  items: MenuItem[]
  label: string
}) {
  const id = useId()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [above, setAbove] = useState(false)

  const actionable = items.flatMap((item, i) => (item === 'separator' ? [] : [i]))

  const triggerEl = () => wrapRef.current?.firstElementChild as HTMLElement | null

  const openMenu = (index = actionable[0] ?? 0) => {
    setActive(index)
    setAbove(false)
    setOpen(true)
  }
  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerEl()?.focus()
  }

  // Flip above the trigger when the menu would run past the viewport bottom.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.bottom > window.innerHeight && rect.height > 0) setAbove(true)
  }, [open])

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus()
  }, [open, active])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const move = (delta: 1 | -1) => {
    const pos = actionable.indexOf(active)
    setActive(actionable[(pos + delta + actionable.length) % actionable.length])
  }

  const select = (index: number) => {
    const item = items[index]
    close(true)
    if (item !== 'separator') item.onSelect()
  }

  const onMenuKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        move(1)
        break
      case 'ArrowUp':
        move(-1)
        break
      case 'Home':
        setActive(actionable[0])
        break
      case 'End':
        setActive(actionable[actionable.length - 1])
        break
      case 'Enter':
      case ' ':
        select(active)
        break
      case 'Escape':
        close(true)
        break
      case 'Tab':
        close(false)
        return
      default:
        return
    }
    e.preventDefault()
  }

  const p = trigger.props
  const triggerWithProps = cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onClick: (e) => {
      p.onClick?.(e)
      if (open) close(false)
      else openMenu()
    },
    onKeyDown: (e) => {
      p.onKeyDown?.(e)
      if (e.key === 'ArrowDown' && !open) {
        e.preventDefault()
        openMenu()
      } else if (e.key === 'ArrowUp' && !open) {
        e.preventDefault()
        openMenu(actionable[actionable.length - 1])
      }
    },
  })

  return (
    <span ref={wrapRef} className={styles.anchor}>
      {triggerWithProps}
      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          className={`${styles.menu} ${above ? styles.above : styles.below}`}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, i) => {
            if (item === 'separator') return <hr key={`sep-${i}`} className={styles.sep} />
            const Icon = item.icon
            return (
              <div
                key={item.id}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                role="menuitem"
                tabIndex={-1}
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                onClick={() => select(i)}
                onMouseMove={() => active !== i && setActive(i)}
              >
                {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />}
                <span>{item.label}</span>
                {item.shortcut && <kbd className={styles.kbd}>{item.shortcut}</kbd>}
              </div>
            )
          })}
        </div>
      )}
    </span>
  )
}

/** The menu's look with one highlighted row, for static previews (no menu semantics). */
export function MenuPreview({ items, highlight }: { items: MenuItem[]; highlight?: string }) {
  return (
    <div className={`${styles.menu} ${styles.static}`}>
      {items.map((item, i) => {
        if (item === 'separator') return <hr key={`sep-${i}`} className={styles.sep} />
        const Icon = item.icon
        return (
          <div
            key={item.id}
            className={[styles.item, item.danger && styles.danger, item.id === highlight && styles.hl]
              .filter(Boolean)
              .join(' ')}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />}
            <span>{item.label}</span>
            {item.shortcut && <kbd className={styles.kbd}>{item.shortcut}</kbd>}
          </div>
        )
      })}
    </div>
  )
}
