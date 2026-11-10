import { Check } from 'lucide-react'
import styles from './Checkbox.module.css'

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange(v: boolean): void
  label: string
}) {
  return (
    <label className={styles.wrap}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.box} aria-hidden>
        <Check size={12} strokeWidth={3} />
      </span>
      {label}
    </label>
  )
}
