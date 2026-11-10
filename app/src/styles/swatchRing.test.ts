/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pickers = readFileSync('src/editor/pickers/Pickers.module.css', 'utf8')

describe('colour swatch ring', () => {
  it('the mode note chip uses the swatch-ring token, not a literal colour', () => {
    const rule = /\.noteChip\s*\{[^}]*\}/.exec(pickers)?.[0] ?? ''
    expect(rule).toContain('var(--swatch-ring)')
    expect(rule).not.toMatch(/rgba?\(/)
  })
})
