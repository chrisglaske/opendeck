import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react'
import styles from './Tooltip.module.css'

const HOVER_DELAY_MS = 400

type TriggerProps = {
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void
  onFocus?: (e: FocusEvent<HTMLElement>) => void
  onBlur?: (e: FocusEvent<HTMLElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void
  'aria-describedby'?: string
}

export function Tooltip({
  content,
  shortcut,
  children,
}: {
  content: string
  shortcut?: string
  children: ReactElement<TriggerProps>
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const clear = () => window.clearTimeout(timer.current)
  useEffect(() => clear, [])

  const show = () => {
    clear()
    setOpen(true)
  }
  const hide = () => {
    clear()
    setOpen(false)
  }
  const p = children.props

  const trigger = cloneElement(children, {
    'aria-describedby': [p['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ') || undefined,
    onMouseEnter: (e) => {
      p.onMouseEnter?.(e)
      clear()
      timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS)
    },
    onMouseLeave: (e) => {
      p.onMouseLeave?.(e)
      hide()
    },
    onFocus: (e) => {
      p.onFocus?.(e)
      show()
    },
    onBlur: (e) => {
      p.onBlur?.(e)
      hide()
    },
    onKeyDown: (e) => {
      p.onKeyDown?.(e)
      if (e.key === 'Escape' && open) hide()
    },
  })

  return (
    <span className={styles.anchor}>
      {trigger}
      {open && (
        <span role="tooltip" id={id} className={styles.tip}>
          {content}
          {shortcut && <kbd className={styles.kbd}>{shortcut}</kbd>}
        </span>
      )}
    </span>
  )
}
