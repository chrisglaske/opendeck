import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { MenuItem } from './Menu'
import styles from './Menu.module.css'

const EDGE = 8

/**
 * A menu opened at a point (right-click, or Shift+F10 on a focused item).
 * The caller decides where focus goes when it closes.
 */
export function ContextMenu({
  x,
  y,
  items,
  label,
  caption,
  onClose,
}: {
  x: number
  y: number
  items: MenuItem[]
  label: string
  caption?: string
  onClose(): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const actionable = items.flatMap((item, i) => (item === 'separator' ? [] : [i]))
  const [active, setActive] = useState(actionable[0] ?? 0)
  const [pos, setPos] = useState({ x, y })

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    setPos({
      x: Math.max(EDGE, Math.min(x, window.innerWidth - r.width - EDGE)),
      y: Math.max(EDGE, Math.min(y, window.innerHeight - r.height - EDGE)),
    })
  }, [x, y])

  useEffect(() => {
    itemRefs.current[active]?.focus()
  }, [active])

  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close.current()
    }
    const onBlur = () => close.current()
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const move = (delta: 1 | -1) => {
    const p = actionable.indexOf(active)
    setActive(actionable[(p + delta + actionable.length) % actionable.length])
  }

  const select = (i: number) => {
    const item = items[i]
    onClose()
    if (item !== 'separator') item.onSelect()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': move(1); break
      case 'ArrowUp': move(-1); break
      case 'Home': setActive(actionable[0]); break
      case 'End': setActive(actionable[actionable.length - 1]); break
      case 'Enter':
      case ' ': select(active); break
      case 'Escape':
      case 'Tab': onClose(); break
      default: return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className={`${styles.menu} ${styles.fixed}`}
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {caption && <div className={styles.cap} aria-hidden>{caption}</div>}
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
  )
}
