import type { Paragraph } from '../model/types'

/**
 * V1 text as V2 paragraphs. V1 always saved what was typed as plain text and showed it escaped,
 * so it stays plain text here: one paragraph per line, nothing read as markup or links.
 * Blank lines at either end are dropped; text with nothing but spaces gives no paragraphs.
 */
export function v1TextToParagraphs(
  text: string,
  opts: { align: Paragraph['align']; list: Paragraph['list'] } = { align: 'left', list: 'none' },
): Paragraph[] {
  if (!text.trim()) return []
  const lines = text.split(/\r?\n/)
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  return lines.map((line) => ({ runs: [{ text: line }], align: opts.align, list: opts.list }))
}
