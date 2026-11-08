import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Popover.module.css'

const EDGE = 8
const GAP = 6

/**
 * A small floating panel under an anchor (a color dot, a field). It flips
 * above when there is no room below and stays inside the viewport. Esc and a
 * press outside close it; the caller decides where focus goes next. It is
 * rendered into the document body so a transformed ancestor can't shift it.
 */
export function Popover({
  anchor,
  label,
  onClose,
  children,
  className,
  style,
  role = 'dialog',
  placement = 'below',
}: {
  anchor: HTMLElement | null
  label: string
  /** `menu` for a list of choices; keyboard handling then belongs to the caller. */
  role?: 'dialog' | 'menu'
  /** Under the anchor (flipping above when needed), or beside it on the right. */
  placement?: 'below' | 'right'
  onClose(): void
  children: ReactNode
  className?: string
  /** Extra custom properties, e.g. the deck theme colors for swatches. */
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const close = useRef(onClose)
  close.current = onClose

  useLayoutEffect(() => {
    const n = ref.current
    if (!n || !anchor) return
    const a = anchor.getBoundingClientRect()
    const w = n.offsetWidth, h = n.offsetHeight
    let left = a.left, top = a.bottom + GAP
    if (placement === 'right') {
      left = a.right + GAP
      top = a.top + a.height / 2 - h / 2
    } else if (top + h > window.innerHeight - EDGE && a.top - GAP - h >= EDGE) top = a.top - GAP - h
    setPos({
      left: Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE)),
      top: Math.max(EDGE, Math.min(top, window.innerHeight - h - EDGE)),
    })
  }, [anchor, placement])

  // Focus the marked control, or the panel itself, once placed (hidden elements can't take focus).
  const focused = useRef(false)
  useEffect(() => {
    const n = ref.current
    if (!pos || !n || focused.current) return
    focused.current = true
    const first = n.querySelector<HTMLElement>('[data-autofocus]') ?? n
    first.focus({ preventScroll: true })
  }, [pos])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor?.contains(t)) return
      close.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [anchor])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    close.current()
  }

  return createPortal(
    <div
      ref={ref}
      role={role}
      aria-label={label}
      tabIndex={-1}
      className={[styles.popover, className].filter(Boolean).join(' ')}
      style={{ ...style, left: `${pos?.left ?? 0}px`, top: `${pos?.top ?? 0}px`, visibility: pos ? undefined : 'hidden' }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>,
    document.body,
  )
}
