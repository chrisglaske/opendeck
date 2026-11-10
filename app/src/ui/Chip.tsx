import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Chip.module.css'

export function Chip({
  tone = 'neutral',
  dot,
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'accent' | 'peach' | 'success'
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span className={[styles.chip, styles[tone], className].filter(Boolean).join(' ')} {...rest}>
      {dot && <i className={styles.dot} aria-hidden />}
      {children}
    </span>
  )
}
