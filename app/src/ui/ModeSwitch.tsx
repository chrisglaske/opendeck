import { Monitor, Moon, Sun } from 'lucide-react'
import type { ColorMode } from '../theme/colorMode'
import { useColorMode } from '../theme/useColorMode'
import styles from './ModeSwitch.module.css'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const satisfies readonly { value: ColorMode; label: string; icon: unknown }[]

// Temporary plain buttons; Task 5 swaps these for SegmentedControl.
export default function ModeSwitch() {
  const { mode, setMode } = useColorMode()
  return (
    <div role="group" aria-label="Appearance" className={styles.root}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          className={styles.option}
          onClick={() => setMode(value)}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
