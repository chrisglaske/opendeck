import { Monitor, Moon, Sun } from 'lucide-react'
import type { ColorMode } from '../theme/colorMode'
import { useColorMode } from '../theme/useColorMode'
import { SegmentedControl, type SegmentedOption } from './SegmentedControl'

const OPTIONS: SegmentedOption<ColorMode>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function ModeSwitch() {
  const { mode, setMode } = useColorMode()
  return <SegmentedControl label="Appearance" options={OPTIONS} value={mode} onChange={setMode} />
}
