import { useEffect, useRef } from 'react'

/** A command, or a command that also runs while typing in a field (`global`). */
export type Shortcut = (() => void) | { run: () => void; global?: boolean }

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

type Combo = { key: string; mod: boolean; shift: boolean; alt: boolean }

/** Parses a key spec such as `'shift+mod+z'`, `'mod+='` or `'t'`. `mod` is ⌘ on Mac, Ctrl elsewhere. */
function parse(spec: string): Combo {
  const parts = spec.toLowerCase().split('+')
  // A trailing "+" key ("mod++") splits into an empty last part.
  const key = parts[parts.length - 1] === '' ? '+' : parts[parts.length - 1]
  return { key, mod: parts.includes('mod'), shift: parts.includes('shift'), alt: parts.includes('alt') }
}

/** The key name used in specs, with layout-dependent variants folded together. */
function keyOf(e: KeyboardEvent): string {
  const k = e.key.toLowerCase()
  if (k === '+') return '=' // ⌘+ and ⌘= both zoom in
  if (k === '_') return '-'
  if (k === 'del') return 'delete'
  return k
}

export function matches(spec: string, e: KeyboardEvent): boolean {
  const c = parse(spec)
  const mod = isMac ? e.metaKey : e.ctrlKey
  const shiftIrrelevant = c.key === '=' || c.key === '-'
  return (
    keyOf(e) === c.key &&
    mod === c.mod &&
    e.altKey === c.alt &&
    (shiftIrrelevant || e.shiftKey === c.shift)
  )
}

/** True when the key press belongs to a text field or editable text. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true
  if (t instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'range', 'color'].includes(t.type)
  return false
}

/** How a spec is shown in tooltips and menus, e.g. `'shift+mod+z'` → "⇧⌘Z" (Mac) or "Ctrl+Shift+Z". */
export function shortcutLabel(spec: string): string {
  const c = parse(spec)
  const key = c.key.length === 1 ? c.key.toUpperCase() : c.key[0].toUpperCase() + c.key.slice(1)
  if (isMac) return `${c.alt ? '⌥' : ''}${c.shift ? '⇧' : ''}${c.mod ? '⌘' : ''}${key}`
  return [c.mod && 'Ctrl', c.alt && 'Alt', c.shift && 'Shift', key].filter(Boolean).join('+')
}

/**
 * Runs commands from a key table while mounted. Key presses in text fields and
 * editable text are left alone unless the entry is `global`.
 */
export function useShortcuts(table: Record<string, Shortcut>, enabled = true): void {
  const ref = useRef(table)
  ref.current = table
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      for (const [spec, entry] of Object.entries(ref.current)) {
        if (!matches(spec, e)) continue
        const global = typeof entry !== 'function' && entry.global
        if (!global && isTypingTarget(e.target)) return
        e.preventDefault()
        if (typeof entry === 'function') entry()
        else entry.run()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
