/** Long enough for any browser to start reading the file (Safari can be slow with large ones). */
const KEEP_URL_MS = 60_000

/** Hands a file to the browser's download, then lets go of the object URL a minute later. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.append(a)
  try {
    a.click()
  } finally {
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), KEEP_URL_MS)
  }
}

/**
 * A file name from a deck, kit or template name in any language: without the characters file
 * systems refuse (/ \ : * ? " < > | and control characters), spaces collapsed, no leading or
 * trailing dots, at most 100 characters, then `ext`. `fallback` when nothing is left.
 */
export function safeFileName(name: string, fallback: string, ext: string): string {
  const safe = name
    .normalize('NFC')
    .replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
  return `${[...safe].slice(0, 100).join('').trim() || fallback}${ext}`
}

export const kitFileName = (name: string) => safeFileName(name, 'brand-kit', '.odtheme')
export const templateFileName = (name: string) => safeFileName(name, 'template', '.odtemplate')
export const htmlFileName = (name: string) => safeFileName(name, 'presentation', '.html')
