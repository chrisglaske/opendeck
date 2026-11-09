import { Palette, Plus, RefreshCw, SlidersHorizontal, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { BrandKit } from '../../model/brandKit'
import { BUILTIN_THEMES } from '../../model/builtinThemes'
import type { Theme } from '../../model/theme'
import { applyTheme, isKitNewer, themeFromKit } from '../../model/themeOps'
import { getDeckStore } from '../../storage/appStore'
import { importKitFile } from '../../storage/kitFile'
import type { KitImportError } from '../../storage/kitFile'
import { useBrandKits } from '../../storage/kits'
import { Button, IconButton, toast } from '../../ui'
import { exitTextEditing } from '../canvas/textSession'
import { useEditor, useEditorStore } from '../EditorContext'
import { SAVE_ERROR_TEXT } from '../SaveStatus'
import type { EditorStore } from '../store'
import { KitMenu } from './KitMenu'
import { ThemeCard } from './ThemeCard'
import { setPreviewTheme } from './themePreview'
import styles from './ThemePanel.module.css'

/** Applies a theme to the whole deck as one undo step, keeping any text being typed. */
export function applyThemeWithToast(store: EditorStore, theme: Theme) {
  exitTextEditing(store)
  store.apply((d) => applyTheme(d, theme))
  setPreviewTheme(null)
  toast(`Theme changed to ${theme.name}`, { actionLabel: 'Undo', onAction: () => store.undo() })
}

const IMPORT_ERRORS: Record<KitImportError, string> = {
  'not-a-kit': "That file isn't a brand kit OpenDeck can use",
  'newer-version': 'That brand kit was made by a newer version of OpenDeck',
  'too-large': 'That file is over 30 MB',
}

async function importKit(file: File) {
  const r = await importKitFile(await getDeckStore(), file)
  if (!r.ok) return toast(IMPORT_ERRORS[r.reason])
  if (r.notSaved) toast(`Added brand kit ${r.kit.theme.name}, but not saved. ${SAVE_ERROR_TEXT[r.notSaved]}`, { durationMs: 8000 })
  else toast(`Added brand kit ${r.kit.theme.name}`)
}

const SWATCHES = ['bg', 'surface', 'text', 'accent', 'accent2'] as const

function ThisDeck({ theme, newerKit, onCustomize }: { theme: Theme; newerKit: BrandKit | null; onCustomize(): void }) {
  const store = useEditorStore()
  const { heading, body } = theme.fonts
  return (
    <section>
      <h3 className={styles.heading}>This deck</h3>
      <div className={styles.current}>
        {newerKit && (
          <div className={styles.update}>
            <RefreshCw size={15} strokeWidth={1.75} aria-hidden />
            <span>
              <b>{newerKit.theme.name} was updated</b> since this deck used it.{' '}
              <button type="button" className={styles.link} onClick={() => applyThemeWithToast(store, themeFromKit(newerKit))}>
                Update this deck
              </button>
            </span>
          </div>
        )}
        <div className={styles.currentName}>
          {theme.name}
          {theme.source && <span className={styles.badge}>{theme.source.kind === 'kit' ? 'Brand kit' : 'Built-in'}</span>}
        </div>
        <div className={styles.currentMeta}>
          <span className={styles.swatches} aria-hidden>
            {SWATCHES.map((k) => (
              <span key={k} className={styles.swatch} style={{ background: theme.colors[k] }} />
            ))}
          </span>
          <span className={styles.fonts}>{heading === body ? heading : `${heading} · ${body}`}</span>
        </div>
        <Button variant="secondary" size="sm" icon={SlidersHorizontal} onClick={onCustomize}>
          Customize
        </Button>
      </div>
    </section>
  )
}

/** The panel's Theme view: the deck's theme, the built-ins and the person's brand kits. */
export function ThemePanel({
  onClose,
  onCustomize,
  onCreateKit,
  onEditKit,
}: {
  onClose(): void
  onCustomize(): void
  onCreateKit(): void
  onEditKit(kit: BrandKit): void
}) {
  const store = useEditorStore()
  const theme = useEditor((s) => s.deck.theme)
  const kits = useBrandKits()
  const kitThemes = useMemo(() => kits.map((k) => ({ kit: k, theme: themeFromKit(k) })), [kits])
  const source = theme.source
  const newerKit = kits.find((k) => isKitNewer(theme, k)) ?? null
  const fileRef = useRef<HTMLInputElement>(null)

  // A preview never outlives the panel.
  useEffect(() => () => setPreviewTheme(null), [])

  return (
    <aside className={styles.panel} aria-label="Theme">
      <div className={styles.head}>
        <Palette size={16} strokeWidth={1.75} aria-hidden />
        <span className={styles.title}>Theme</span>
        <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
      </div>
      <div className={styles.body}>
        <ThisDeck theme={theme} newerKit={newerKit} onCustomize={onCustomize} />
        <section>
          <h3 className={styles.heading}>Built-in</h3>
          <div className={styles.grid}>
            {BUILTIN_THEMES.map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                current={source?.kind === 'builtin' && source.id === t.id}
                onApply={() => applyThemeWithToast(store, t)}
              />
            ))}
          </div>
        </section>
        <section>
          <h3 className={styles.heading}>
            Your brand kits
            <button type="button" className={`${styles.link} ${styles.headingLink}`} onClick={() => fileRef.current?.click()}>
              <Upload size={12} strokeWidth={2} aria-hidden />
              Import
            </button>
          </h3>
          <input
            ref={fileRef}
            type="file"
            hidden
            aria-label="Brand kit file"
            accept=".odtheme,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void importKit(file)
            }}
          />
          <div className={styles.grid}>
            {kitThemes.map(({ kit, theme: t }) => (
              <ThemeCard
                key={kit.id}
                theme={t}
                current={source?.kind === 'kit' && source.id === kit.id}
                onApply={() => applyThemeWithToast(store, t)}
                more={<KitMenu kit={kit} onEdit={() => onEditKit(kit)} />}
              />
            ))}
            <button type="button" className={styles.add} onClick={onCreateKit}>
              <Plus size={16} strokeWidth={1.75} aria-hidden />
              Create brand kit
            </button>
          </div>
        </section>
      </div>
    </aside>
  )
}
