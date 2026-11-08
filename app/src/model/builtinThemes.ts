import { OPENDECK_THEME } from './theme'
import type { Theme } from './theme'

type Spec = {
  id: string; name: string; colors: Theme['colors']; heading: string; body: string
  radius: number; titleWeight: number; titleLs: number
}

/** Every built-in shares OpenDeck's sizes and line heights; weight and letter spacing set the character. */
function make(s: Spec): Theme {
  const base = OPENDECK_THEME.text
  return {
    id: s.id,
    name: s.name,
    colors: s.colors,
    fonts: { heading: s.heading, body: s.body },
    radius: s.radius,
    text: {
      title: { ...base.title, weight: s.titleWeight, letterSpacing: s.titleLs },
      heading: { ...base.heading, weight: s.titleWeight, letterSpacing: s.titleLs },
      body: { ...base.body },
      caption: { ...base.caption },
    },
    logo: {},
    manualColors: [],
    source: { kind: 'builtin', id: s.id, name: s.name, updatedAt: 0 },
  }
}

/** The six built-in themes, in the order the theme panel shows them. */
export const BUILTIN_THEMES: readonly Theme[] = [
  OPENDECK_THEME,
  make({
    id: 'boardroom', name: 'Boardroom', heading: 'IBM Plex Sans', body: 'IBM Plex Sans', radius: 7, titleWeight: 600, titleLs: -0.015,
    colors: { bg: '#FFFFFF', surface: '#EEF2F7', text: '#0F2235', muted: '#4A5A6C', accent: '#1D5FD1', accentText: '#1D5FD1', onAccent: '#FFFFFF', accent2: '#0F2235', line: '#DCE3EC' },
  }),
  make({
    id: 'editorial', name: 'Editorial', heading: 'Fraunces', body: 'Inter', radius: 0, titleWeight: 600, titleLs: -0.01,
    colors: { bg: '#F6F1E9', surface: '#ECE4D6', text: '#221C16', muted: '#665B4F', accent: '#B0432A', accentText: '#A33D25', onAccent: '#FFFFFF', accent2: '#2F4A3A', line: '#DDD2C0' },
  }),
  make({
    id: 'midnight', name: 'Midnight', heading: 'Space Grotesk', body: 'Inter', radius: 19, titleWeight: 700, titleLs: -0.025,
    colors: { bg: '#0E1320', surface: '#182136', text: '#EEF2F8', muted: '#9AA6BA', accent: '#3FD0C9', accentText: '#3FD0C9', onAccent: '#0E1320', accent2: '#F5B94A', line: '#263049' },
  }),
  make({
    id: 'sage', name: 'Sage', heading: 'DM Sans', body: 'DM Sans', radius: 46, titleWeight: 700, titleLs: -0.03,
    colors: { bg: '#F2F4EE', surface: '#E2E9DA', text: '#1D2B22', muted: '#4F5E53', accent: '#2E7650', accentText: '#2A6C49', onAccent: '#FFFFFF', accent2: '#E7B56A', line: '#D3DCC9' },
  }),
  make({
    id: 'swiss', name: 'Swiss', heading: 'Inter Tight', body: 'Inter', radius: 0, titleWeight: 800, titleLs: -0.045,
    colors: { bg: '#FFFFFF', surface: '#F1F1F1', text: '#111111', muted: '#555555', accent: '#E1251B', accentText: '#C81E15', onAccent: '#FFFFFF', accent2: '#111111', line: '#DDDDDD' },
  }),
]

/** A copy of a built-in theme, safe to change. */
export function builtinTheme(id: string): Theme | undefined {
  const t = BUILTIN_THEMES.find((x) => x.id === id)
  return t ? structuredClone(t) : undefined
}

export const CORNER_PRESETS: readonly { id: 'square' | 'slight' | 'soft' | 'round'; label: string; px: number }[] = [
  { id: 'square', label: 'Square', px: 0 },
  { id: 'slight', label: 'Slight', px: 12 },
  { id: 'soft', label: 'Soft', px: 27 },
  { id: 'round', label: 'Round', px: 46 },
]
