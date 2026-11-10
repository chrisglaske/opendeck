import type { LucideIcon } from 'lucide-react'
import { useId, type InputHTMLAttributes } from 'react'
import styles from './Field.module.css'

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  icon?: LucideIcon
}

export function TextField({ label, icon: Icon, id, className, ...rest }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.field}>
        {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />}
        <input id={inputId} className={styles.input} {...rest} />
      </div>
    </div>
  )
}
