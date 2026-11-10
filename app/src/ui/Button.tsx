import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: LucideIcon
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
      {children}
    </button>
  )
}
