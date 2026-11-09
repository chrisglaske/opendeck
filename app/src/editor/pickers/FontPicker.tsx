import { Check, ChevronDown, CircleAlert, Search, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { isFontAvailable } from '../../fonts/availability'
import { BUNDLED_FONTS, FONT_CATEGORY_LABELS } from '../../fonts/catalog'
import type { FontCategory } from '../../fonts/catalog'
import { FONT_EXTENSIONS } from '../../fonts/fontFile'
import type { FontStyle } from '../../fonts/fontFile'
import { faceLabel, importFontFiles, useUploadedFonts } from '../../fonts/uploadedFonts'
import type { FontImportResult } from '../../fonts/uploadedFonts'
import { getDeckStore } from '../../storage/appStore'
import { Button, Popover, toast } from '../../ui'
import { SAVE_ERROR_TEXT } from '../SaveStatus'
import s from './Pickers.module.css'

/** CSS font-family that draws a font's name in the font itself. */
const preview = (family: string) => `'${family} Variable', '${family}', var(--font-ui)`

const CATEGORIES = Object.keys(FONT_CATEGORY_LABELS) as FontCategory[]

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

function facesText(faces: readonly string[]): string {
  return faces
    .map((f) => {
      const [weight, style] = f.split(' ')
      return faceLabel(weight, (style as FontStyle | undefined) ?? 'normal')
    })
    .join(' · ')
}

type Item = { family: string; missing: boolean }
type Group = { label: string; items: Item[] }
type Upload = { key: number; files: File[]; results: FontImportResult[] | null }

/** One upload's cards: progress while the files are read, then one card per family or failed file. */
function UploadCards({ upload }: { upload: Upload }) {
  if (!upload.results) {
    const bytes = upload.files.reduce((n, f) => n + f.size, 0)
    const label = upload.files.length === 1 ? upload.files[0].name : `${upload.files.length} files`
    return (
      <div className={s.fontCard}>
        <span className={s.aa} aria-hidden>Aa</span>
        <div className={s.grow}>
          <b>Adding fonts…</b>
          <div className={s.fontMeta}>
            {label} · {formatBytes(bytes)}
          </div>
          <div className={s.progress} role="progressbar" aria-label="Adding fonts" />
        </div>
      </div>
    )
  }
  return (
    <>
      {upload.results.map((r) =>
        r.ok ? (
          <div key={r.family} className={s.fontCard}>
            <span className={s.aa} style={{ fontFamily: preview(r.family) }} aria-hidden>Aa</span>
            <div className={s.grow}>
              <b>{r.family}</b>
              <div className={s.fontMeta}>
                {facesText(r.faces)} · {formatBytes(r.bytes)}
              </div>
            </div>
            <span className={s.added}>
              <Check size={11} strokeWidth={2.25} aria-hidden />
              Added
            </span>
          </div>
        ) : (
          <div key={r.fileName} className={s.fontError} role="alert">
            <CircleAlert size={15} strokeWidth={1.75} aria-hidden />
            <span>
              <b>{r.reason === 'too-large' ? `"${r.fileName}" is over 2 MB.` : `"${r.fileName}" isn't a font.`}</b>{' '}
              <span>Use a .woff2, .woff, .ttf or .otf file up to 2 MB.</span>
            </span>
          </div>
        ),
      )}
    </>
  )
}

/**
 * The font list used by the quick bar and the brand kit: uploaded fonts first (with any the
 * deck uses but this browser lacks), then the bundled fonts by kind, and an upload button.
 */
export function FontPicker({
  value,
  roles,
  inUse = [],
  onPick,
  onClosed,
  variant,
  label,
}: {
  value: string
  /** The theme's fonts, tagged in the list. */
  roles?: { heading: string; body: string }
  /** Families the deck or kit uses; missing ones are listed so they can be uploaded again. */
  inUse?: readonly string[]
  onPick(family: string): void
  onClosed?(): void
  variant: 'quick' | 'field'
  label: string
}) {
  const uploaded = useUploadedFonts()
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [upload, setUpload] = useState<Upload | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const uploads = useRef(0)

  const groups = useMemo<Group[]>(() => {
    const have = new Set(uploaded.families)
    const extra = [...new Set([...inUse, value])].filter((f) => f && !isFontAvailable(f, have))
    const q = query.trim().toLowerCase()
    const match = (f: string) => !q || f.toLowerCase().includes(q)
    const top = [...uploaded.families.map((family) => ({ family, missing: false })), ...extra.map((family) => ({ family, missing: true }))]
      .sort((a, b) => a.family.localeCompare(b.family))
      .filter((i) => match(i.family))
    const out: Group[] = top.length ? [{ label: 'Uploaded', items: top }] : []
    for (const c of CATEGORIES) {
      const items = BUNDLED_FONTS.filter((f) => f.category === c && match(f.family)).map((f) => ({ family: f.family, missing: false }))
      if (items.length) out.push({ label: FONT_CATEGORY_LABELS[c], items })
    }
    return out
  }, [uploaded.families, inUse, value, query])

  const close = () => {
    setOpen(false)
    setQuery('')
    setUpload(null)
    if (onClosed) onClosed()
    else anchor?.focus()
  }
  const pick = (family: string) => {
    onPick(family)
    close()
  }
  const items = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    const key = ++uploads.current
    setUpload({ key, files, results: null })
    const results = await importFontFiles(await getDeckStore(), files)
    if (uploads.current !== key) return
    setUpload({ key, files, results })
    const notSaved = results.find((r) => r.ok && r.notSaved)
    if (notSaved?.ok && notSaved.notSaved) toast(`Font added, but not saved. ${SAVE_ERROR_TEXT[notSaved.notSaved]}`, { durationMs: 8000 })
  }

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items()[0]?.focus()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const first = groups[0]?.items[0]
      if (first) pick(first.family)
    } else if (e.key === 'Tab' && !e.shiftKey && !items().length) close()
  }

  const onItemKey = (e: KeyboardEvent<HTMLElement>, item: Item) => {
    const list = items()
    const i = list.indexOf(e.currentTarget)
    const move = (to: number) => {
      e.preventDefault()
      list[Math.max(0, Math.min(list.length - 1, to))]?.focus()
    }
    if (e.key === 'ArrowDown') move(i + 1)
    else if (e.key === 'ArrowUp') {
      if (i === 0) {
        e.preventDefault()
        searchRef.current?.focus()
      } else move(i - 1)
    } else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(list.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate(item)
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Typing on the list goes to the search field.
      searchRef.current?.focus()
    }
  }

  const activate = (item: Item) => {
    if (item.missing) fileRef.current?.click()
    else pick(item.family)
  }

  const roleOf = (family: string) =>
    roles ? [family === roles.heading && 'Heading', family === roles.body && 'Body'].filter(Boolean).join(' · ') : ''
  const tag = (family: string) => {
    const r = roleOf(family)
    return r ? <span className={s.fontTag}>{r}</span> : null
  }
  const itemLabel = (item: Item) => {
    if (item.missing) return `${item.family}, missing, upload again`
    const r = roleOf(item.family)
    return r ? `${item.family}, ${r.toLowerCase().replace(' · ', ' and ')} font` : item.family
  }

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={variant === 'quick' ? s.qfield : s.fontField}
        aria-label={`${label}: ${value}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseDown={variant === 'quick' ? (e) => e.preventDefault() : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className={variant === 'quick' ? s.qfieldText : s.fontFieldText} style={variant === 'field' ? { fontFamily: preview(value) } : undefined}>
          {value}
        </span>
        {variant === 'field' && uploaded.families.includes(value) && <span className={s.fontBadge}>Uploaded</span>}
        <ChevronDown size={variant === 'quick' ? 13 : 15} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <Popover anchor={anchor} label="Font" onClose={close} className={s.fontPicker}>
          <div className={s.fontSearch}>
            <Search size={14} strokeWidth={1.75} aria-hidden />
            <input
              ref={searchRef}
              type="search"
              aria-label="Search fonts"
              placeholder="Search fonts"
              value={query}
              data-autofocus=""
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
            />
          </div>
          <div ref={listRef} role="menu" aria-label="Fonts" className={s.fontList}>
            {groups.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div className={s.grp} aria-hidden>
                  {g.label}
                </div>
                {g.items.map((item) => (
                  <div
                    key={item.family}
                    role="menuitemradio"
                    aria-label={itemLabel(item)}
                    aria-checked={item.family === value}
                    tabIndex={-1}
                    className={s.fontItem}
                    data-missing={item.missing || undefined}
                    onClick={() => activate(item)}
                    onKeyDown={(e) => onItemKey(e, item)}
                  >
                    <span className={s.fontItemText}>
                      <span className={s.fontName} style={{ fontFamily: item.missing ? undefined : preview(item.family) }}>
                        {item.family}
                      </span>
                      {item.missing && <span className={s.missing}>Missing · upload again</span>}
                    </span>
                    {item.missing ? (
                      <Upload size={14} strokeWidth={1.75} className={s.fontTag} aria-hidden />
                    ) : (
                      <span className={s.fontEnd}>
                        {tag(item.family)}
                        {item.family === value && <Check size={15} strokeWidth={2} className={s.check} aria-hidden />}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {!groups.length && <div className={s.menuNote}>No fonts match</div>}
          </div>
          {upload && (
            <div className={s.uploads}>
              <UploadCards upload={upload} />
              {!upload.results && (
                <p className={s.fontHint}>Only upload fonts you're allowed to embed. The font is saved in this browser and inside decks and brand kits you export.</p>
              )}
            </div>
          )}
          <div className={s.fontFoot}>
            <Button variant="secondary" size="sm" icon={Upload} className={s.grow} onClick={() => fileRef.current?.click()}>
              Upload a font file
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              aria-label="Font files"
              accept={FONT_EXTENSIONS.join(',')}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ''
                void addFiles(files)
              }}
            />
          </div>
        </Popover>
      )}
    </>
  )
}
