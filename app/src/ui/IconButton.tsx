import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import styles from './IconButton.module.css'
import { Tooltip } from './Tooltip'

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: LucideIcon
  label: string
  pressed?: boolean
  size?: 'sm' | 'md'
  shortcut?: string
}

export function IconButton({
  icon: Icon,
  label,
  pressed,
  size = 'md',
  shortcut,
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip content={label} shortcut={shortcut}>
      <button
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={[styles.ibtn, styles[size], className].filter(Boolean).join(' ')}
        {...rest}
      >
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </Tooltip>
  )
}
