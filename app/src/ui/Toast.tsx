import type { LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type HTMLAttributes, type Ref } from 'react'
import styles from './Toast.module.css'

type ToastOptions = { actionLabel?: string; onAction?(): void; durationMs?: number }
type ToastData = ToastOptions & { id: number; message: string }

const MAX_TOASTS = 3
const listeners = new Set<(t: ToastData) => void>()
const holdListeners = new Set<(held: boolean) => void>()
let held = false
let nextId = 1

/**
 * While held (a show is running), toasts are kept but not shown, so nothing covers the slides;
 * they show, with their full time, once released.
 */
export function holdToasts(hold: boolean): void {
  held = hold
  for (const l of holdListeners) l(hold)
}

/** Shows a short message in the mounted <ToastHost/>. */
export function toast(message: string, opts: ToastOptions = {}): void {
  const t = { ...opts, id: nextId++, message }
  for (const l of listeners) l(t)
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [isHeld, setHeld] = useState(held)

  useEffect(() => {
    // Over the limit, the oldest toast that times out goes first; one with no time limit stays.
    const add = (t: ToastData) => setToasts((list) => {
      const next = [...list, t]
      while (next.length > MAX_TOASTS) {
        const i = next.findIndex((x) => Number.isFinite(x.durationMs ?? 5000))
        if (i < 0 || i === next.length - 1) break
        next.splice(i, 1)
      }
      return next
    })
    listeners.add(add)
    holdListeners.add(setHeld)
    setHeld(held)
    return () => {
      listeners.delete(add)
      holdListeners.delete(setHeld)
    }
  }, [])

  const dismiss = (id: number) => setToasts((list) => list.filter((t) => t.id !== id))

  return (
    <div role="status" aria-live="polite" className={styles.host}>
      {!isHeld && toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: ToastData; onDismiss(): void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const remaining = useRef(t.durationMs ?? 5000)
  const startedAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  // Hover and keyboard focus each hold the timer; it runs only when neither does.
  const holds = useRef(new Set<'hover' | 'focus'>())
  const returnFocusTo = useRef<HTMLElement | null>(null)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  // A toast with no time limit (durationMs: Infinity) stays until it is acted on or dismissed.
  const timed = Number.isFinite(remaining.current)
  const hold = (why: 'hover' | 'focus') => {
    if (holds.current.size === 0 && timed) {
      window.clearTimeout(timer.current)
      remaining.current -= Date.now() - startedAt.current
    }
    holds.current.add(why)
  }
  const release = (why: 'hover' | 'focus') => {
    if (!holds.current.delete(why) || holds.current.size > 0 || !timed) return
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => dismissRef.current(), remaining.current)
  }

  useEffect(() => {
    if (!timed) return
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => dismissRef.current(), remaining.current)
    return () => window.clearTimeout(timer.current)
  }, [])

  // Runs before the node is removed: if focus is inside, send it back where it came from.
  useLayoutEffect(() => {
    const root = rootRef.current
    return () => {
      if (root?.contains(document.activeElement)) returnFocusTo.current?.focus()
    }
  }, [])

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const from = e.relatedTarget as HTMLElement | null
    if (!e.currentTarget.contains(from)) returnFocusTo.current = from
    hold('focus')
  }
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) release('focus')
  }

  return (
    <ToastView
      ref={rootRef}
      message={t.message}
      actionLabel={t.actionLabel}
      onAction={() => {
        t.onAction?.()
        onDismiss()
      }}
      onMouseEnter={() => hold('hover')}
      onMouseLeave={() => release('hover')}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  )
}

/** The toast's look, also used for static previews. */
export function ToastView({
  ref,
  message,
  icon: Icon,
  actionLabel,
  onAction,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  ref?: Ref<HTMLDivElement>
  message: string
  icon?: LucideIcon
  actionLabel?: string
  onAction?(): void
}) {
  return (
    <div ref={ref} className={styles.toast} {...rest}>
      {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
      <span>{message}</span>
      {actionLabel && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
