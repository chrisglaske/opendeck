import { Check, ChevronRight } from 'lucide-react'
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
      /** A short note at the end of the row, such as a count. */
      hint?: string
      danger?: boolean
      /** Shown greyed out; it can be reached with the keyboard but does nothing. */
      disabled?: boolean
      /** Makes the row one choice of a set (a radio item) and shows a check when true. */
      checked?: boolean
      /** Opens a submenu (ArrowRight, Enter, a click or hover) instead of running `onSelect`. */
      submenu?: MenuItem[]
      onSelect(): void
    }
  | 'separator'

type Item = Exclude<MenuItem, 'separator'>

type TriggerProps = {
  onClick?: (e: MouseEvent<HTMLElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void
  'aria-haspopup'?: 'menu'
  'aria-expanded'?: boolean
  'aria-controls'?: string
}

const actionableOf = (items: MenuItem[]) => items.flatMap((item, i) => (item === 'separator' ? [] : [i]))

export function Menu({
  trigger,
  items,
  label,
  align = 'start',
  open: openProp,
  onOpenChange,
}: {
  trigger: ReactElement<TriggerProps>
  items: MenuItem[]
  label: string
  /** Which edge of the trigger the menu prefers to line up with; it switches when that side would be cut off. */
  align?: 'start' | 'end'
  /** Set to open or close the menu from outside (for example on right-click). */
  open?: boolean
  onOpenChange?(open: boolean): void
}) {
  const id = useId()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const subRefs = useRef<(HTMLDivElement | null)[]>([])
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const [active, setActive] = useState(0)
  /** Index of the item whose submenu is open, and which of its items is active (-1: focus stays on the parent). */
  const [sub, setSub] = useState<{ parent: number; active: number } | null>(null)
  const [above, setAbove] = useState(false)
  const [shift, setShift] = useState(0)

  const actionable = actionableOf(items)
  const subItems = sub ? ((items[sub.parent] as Item).submenu ?? []) : []
  const subActionable = actionableOf(subItems)

  const triggerEl = () => wrapRef.current?.firstElementChild as HTMLElement | null

  const setOpen = (v: boolean) => {
    setOpenState(v)
    onOpenChange?.(v)
  }
  const reset = (index: number) => {
    setActive(index)
    setSub(null)
    setAbove(false)
    setShift(0)
  }
  const openMenu = (index = actionable[0] ?? 0) => {
    reset(index)
    setOpen(true)
  }
  const close = (returnFocus: boolean) => {
    setOpen(false)
    setSub(null)
    if (returnFocus) triggerEl()?.focus()
  }

  // Opened from outside: start on the first item.
  const wasOpen = useRef(open)
  useLayoutEffect(() => {
    if (open && !wasOpen.current && openProp !== undefined) reset(actionable[0] ?? 0)
    wasOpen.current = open
  })

  // Flip above the trigger when the menu would run past the viewport bottom.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.bottom > window.innerHeight && rect.height > 0) setAbove(true)
    // Slide sideways just enough to stay inside the box that would cut it off.
    const clip = clipBounds(menuRef.current)
    if (rect.width > 0) setShift(Math.max(clip.left - rect.left, Math.min(0, clip.right - rect.right)))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (sub && sub.active >= 0) subRefs.current[sub.active]?.focus()
    else itemRefs.current[active]?.focus()
  }, [open, active, sub])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  })

  const step = (list: number[], from: number, delta: 1 | -1) => list[(list.indexOf(from) + delta + list.length) % list.length]

  const openSub = (parent: number, focusFirst: boolean) => {
    const list = actionableOf((items[parent] as Item).submenu ?? [])
    setActive(parent)
    setSub({ parent, active: focusFirst ? (list[0] ?? -1) : -1 })
  }

  const select = (item: Item, index: number) => {
    if (item.disabled) return
    if (item.submenu) {
      openSub(index, true)
      return
    }
    close(true)
    item.onSelect()
  }

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const inSub = sub !== null && sub.active >= 0
    if (inSub) {
      const subItem = subItems[sub.active] as Item
      switch (e.key) {
        case 'ArrowDown':
          setSub({ ...sub, active: step(subActionable, sub.active, 1) })
          break
        case 'ArrowUp':
          setSub({ ...sub, active: step(subActionable, sub.active, -1) })
          break
        case 'Home':
          setSub({ ...sub, active: subActionable[0] })
          break
        case 'End':
          setSub({ ...sub, active: subActionable[subActionable.length - 1] })
          break
        case 'ArrowLeft':
          setSub(null)
          break
        case 'Enter':
        case ' ':
          if (!subItem.disabled) {
            close(true)
            subItem.onSelect()
          }
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
      return
    }
    const item = items[active] as Item
    switch (e.key) {
      case 'ArrowDown':
        setSub(null)
        setActive(step(actionable, active, 1))
        break
      case 'ArrowUp':
        setSub(null)
        setActive(step(actionable, active, -1))
        break
      case 'Home':
        setSub(null)
        setActive(actionable[0])
        break
      case 'End':
        setSub(null)
        setActive(actionable[actionable.length - 1])
        break
      case 'ArrowRight':
        if (item.submenu && !item.disabled) openSub(active, true)
        break
      case 'Enter':
      case ' ':
        select(item, active)
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

  const row = (item: Item, opts: { ref(el: HTMLDivElement | null): void; onClick(): void; onHover(): void; expanded?: boolean; subId?: string }) => {
    const Icon = item.icon
    const radio = item.checked !== undefined
    return (
      <div
        key={item.id}
        ref={opts.ref}
        role={radio ? 'menuitemradio' : 'menuitem'}
        aria-checked={radio ? item.checked : undefined}
        aria-disabled={item.disabled || undefined}
        aria-haspopup={item.submenu ? 'menu' : undefined}
        aria-expanded={item.submenu ? !!opts.expanded : undefined}
        aria-controls={opts.expanded ? opts.subId : undefined}
        tabIndex={-1}
        className={[styles.item, item.danger && styles.danger, item.disabled && styles.disabled].filter(Boolean).join(' ')}
        onClick={opts.onClick}
        onMouseEnter={opts.onHover}
        onMouseMove={opts.onHover}
      >
        {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />}
        <span className={styles.label}>{item.label}</span>
        {item.shortcut && <kbd className={styles.kbd}>{item.shortcut}</kbd>}
        {item.hint && <span className={styles.kbd}>{item.hint}</span>}
        {item.checked && <Check size={16} strokeWidth={1.75} aria-hidden className={styles.check} />}
        {item.submenu && <ChevronRight size={16} strokeWidth={1.75} aria-hidden className={styles.chev} />}
      </div>
    )
  }

  const subId = `${id}-sub`
  return (
    <span ref={wrapRef} className={styles.anchor}>
      {triggerWithProps}
      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          className={`${styles.menu} ${above ? styles.above : styles.below} ${align === 'end' ? styles.end : ''}`}
          style={shift ? { translate: `${shift}px 0` } : undefined}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, i) => {
            if (item === 'separator') return <hr key={`sep-${i}`} className={styles.sep} />
            const expanded = sub?.parent === i
            return (
              <div key={item.id} className={styles.rowWrap}>
                {row(item, {
                  ref: (el) => {
                    itemRefs.current[i] = el
                  },
                  onClick: () => select(item, i),
                  onHover: () => {
                    if (active !== i || (sub && sub.parent !== i)) {
                      setActive(i)
                      setSub(item.submenu && !item.disabled ? { parent: i, active: -1 } : null)
                    } else if (item.submenu && !item.disabled && !sub) setSub({ parent: i, active: -1 })
                  },
                  expanded,
                  subId,
                })}
                {expanded && (
                  <div id={subId} role="menu" aria-label={item.label} className={`${styles.menu} ${styles.sub}`}>
                    {subItems.map((s, j) =>
                      s === 'separator' ? (
                        <hr key={`sep-${j}`} className={styles.sep} />
                      ) : (
                        row(s, {
                          ref: (el) => {
                            subRefs.current[j] = el
                          },
                          onClick: () => {
                            if (s.disabled) return
                            close(true)
                            s.onSelect()
                          },
                          onHover: () => {
                            if (sub?.active !== j) setSub({ parent: i, active: j })
                          },
                        })
                      ),
                    )}
                  </div>
                )}
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
            {item.hint && <span className={styles.kbd}>{item.hint}</span>}
          </div>
        )
      })}
    </div>
  )
}

/** Space kept between a slid menu and the edge it would otherwise touch. */
const EDGE_GAP = 8

/** The horizontal edges of the nearest ancestor that cuts off overflow, or the window. */
function clipBounds(el: HTMLElement): { left: number; right: number } {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (getComputedStyle(p).overflowX !== 'visible') {
      const r = p.getBoundingClientRect()
      return { left: Math.max(r.left, 0) + EDGE_GAP, right: Math.min(r.right, window.innerWidth) - EDGE_GAP }
    }
  }
  return { left: EDGE_GAP, right: window.innerWidth - EDGE_GAP }
}
