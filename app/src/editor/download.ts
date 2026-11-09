/** Hands a file to the browser's download, then lets go of the object URL. */
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
    setTimeout(() => URL.revokeObjectURL(url), 0)
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
