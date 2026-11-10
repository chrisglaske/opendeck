import { useId } from 'react'
import styles from './Toggle.module.css'

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange(v: boolean): void
  label: string
}) {
  const id = useId()
  return (
    <span className={styles.wrap}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={styles.track}
        onClick={() => onChange(!checked)}
      />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
    </span>
  )
}
