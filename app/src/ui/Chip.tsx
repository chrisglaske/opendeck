import type { ReactNode } from 'react'
import styles from './Chip.module.css'

export function Chip({
  tone = 'neutral',
  dot,
  children,
}: {
  tone?: 'neutral' | 'accent' | 'peach' | 'success'
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span className={`${styles.chip} ${styles[tone]}`}>
      {dot && <i className={styles.dot} aria-hidden />}
      {children}
    </span>
  )
}
