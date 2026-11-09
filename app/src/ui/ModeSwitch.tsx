import { Monitor, Moon, Sun } from 'lucide-react'
import type { ColorMode } from '../theme/colorMode'
import { useColorMode } from '../theme/useColorMode'
import { SegmentedControl, type SegmentedOption } from './SegmentedControl'

const OPTIONS: SegmentedOption<ColorMode>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** Fits a narrow sidebar: sun and moon icons, and "Auto" for following the system. */
const COMPACT: SegmentedOption<ColorMode>[] = [
  { value: 'light', label: 'Light', icon: Sun, iconOnly: true },
  { value: 'dark', label: 'Dark', icon: Moon, iconOnly: true },
  { value: 'system', label: 'Auto' },
]

export default function ModeSwitch({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useColorMode()
  return <SegmentedControl label="Appearance" options={compact ? COMPACT : OPTIONS} value={mode} onChange={setMode} />
}
