import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type HTMLAttributes } from 'react'
import styles from './Toast.module.css'

type ToastOptions = { actionLabel?: string; onAction?(): void; durationMs?: number }
type ToastData = ToastOptions & { id: number; message: string }

const MAX_TOASTS = 3
const listeners = new Set<(t: ToastData) => void>()
let nextId = 1

/** Shows a short message in the mounted <ToastHost/>. */
export function toast(message: string, opts: ToastOptions = {}): void {
  const t = { ...opts, id: nextId++, message }
  for (const l of listeners) l(t)
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    const add = (t: ToastData) => setToasts((list) => [...list, t].slice(-MAX_TOASTS))
    listeners.add(add)
    return () => {
      listeners.delete(add)
    }
  }, [])

  const dismiss = (id: number) => setToasts((list) => list.filter((t) => t.id !== id))

  return (
    <div role="status" aria-live="polite" className={styles.host}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: ToastData; onDismiss(): void }) {
  const remaining = useRef(t.durationMs ?? 5000)
  const startedAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  const start = () => {
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => dismissRef.current(), remaining.current)
  }
  const pause = () => {
    window.clearTimeout(timer.current)
    remaining.current -= Date.now() - startedAt.current
  }

  useEffect(() => {
    start()
    return () => window.clearTimeout(timer.current)
  }, [])

  return (
    <ToastView
      message={t.message}
      actionLabel={t.actionLabel}
      onAction={() => {
        t.onAction?.()
        onDismiss()
      }}
      onMouseEnter={pause}
      onMouseLeave={start}
    />
  )
}

/** The toast's look, also used for static previews. */
export function ToastView({
  message,
  icon: Icon,
  actionLabel,
  onAction,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  message: string
  icon?: LucideIcon
  actionLabel?: string
  onAction?(): void
}) {
  return (
    <div className={styles.toast} {...rest}>
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
