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

/** A file name for a brand kit: only plain characters, spaces collapsed, ending in .odtheme. */
export function kitFileName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9 ._-]/g, '').replace(/\s+/g, ' ').trim()
  return `${safe.replace(/^\.+$/, '') || 'brand-kit'}.odtheme`
}

/** A safe file name for a template file, from its name. */
export function templateFileName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9 ._-]/g, '').replace(/\s+/g, ' ').trim()
  return `${safe.replace(/^\.+$/, '') || 'template'}.odtemplate`
}

/**
 * A file name for a downloaded presentation: the deck's name in any language, without the
 * characters file systems refuse (/ \ : * ? " < > | and control characters), ending in .html.
 */
export function htmlFileName(name: string): string {
  const safe = name
    .normalize('NFC')
    .replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
  return `${[...safe].slice(0, 100).join('').trim() || 'presentation'}.html`
}
