import { BookmarkPlus, LayoutTemplate, Replace, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { BUILTIN_TEMPLATES } from '../../templates/builtins'
import { addSlideFromTemplate } from '../../templates/instantiate'
import { matchesQuery } from '../../templates/search'
import { GROUPS, groupLabel, layoutRef } from '../../templates/types'
import type { Template, TemplateGroup } from '../../templates/types'
import { IconButton, TextField } from '../../ui'
import { exitTextEditing } from '../canvas/textSession'
import { useEditor, useEditorStore } from '../EditorContext'
import { changeLayout, slideInLayout } from './changeLayout'
import { setLayoutPreview } from './layoutPreview'
import { BlankCard, TemplateCard } from './TemplateCard'
import styles from './SlidesPanel.module.css'

type ChipId = 'all' | 'mine' | TemplateGroup
type Item = { key: string; template: Template | null }
type Section = { id: 'blank' | 'mine' | TemplateGroup; heading?: string; items: Item[] }

const BLANK: Item = { key: 'blank', template: null }
const EMPTY: readonly Template[] = []

const chunk = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/**
 * The Slides panel. In add mode, clicking a card adds that slide after the current one and the
 * panel stays open; in change mode (layout switching) the current layout is marked.
 * The cards form one keyboard grid across all sections, two to a row.
 */
export function SlidesPanel({
  mode,
  onClose,
  mine = EMPTY,
}: {
  mode: 'add' | 'change'
  onClose(): void
  mine?: readonly Template[]
}) {
  const store = useEditorStore()
  const theme = useEditor((s) => s.deck.theme)
  const slide = useEditor((s) => s.deck.slides.find((x) => x.id === s.selection.slideId))
  const currentLayout = slide?.layout
  const uid = useId()
  const [query, setQuery] = useState('')
  const [chip, setChip] = useState<ChipId>('all')
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())

  const sections = useMemo<Section[]>(() => {
    const hit = (t: Template) => matchesQuery({ name: t.name, keywords: t.keywords, groupLabel: groupLabel(t.group) }, query)
    const out: Section[] = []
    if (mode === 'add' && matchesQuery({ name: 'Blank', keywords: [], groupLabel: '' }, query)) out.push({ id: 'blank', items: [BLANK] })
    const myHits = mine.filter(hit)
    // With nothing typed, My templates always shows (with its empty state when there are none).
    if (myHits.length > 0 || (query.trim() === '' && mode === 'add')) {
      out.push({ id: 'mine', heading: 'My templates', items: myHits.map((t) => ({ key: layoutRef(t), template: t })) })
    }
    for (const g of GROUPS) {
      const items = BUILTIN_TEMPLATES.filter((t) => t.group === g.id && hit(t)).map((t) => ({ key: layoutRef(t), template: t }))
      if (items.length) out.push({ id: g.id, heading: g.label, items })
    }
    return out
  }, [mine, mode, query])

  // Every visible card in order, and the rows the arrow keys move between.
  const { flat, rows } = useMemo(() => {
    const flat: Item[] = []
    const rows: number[][] = []
    for (const s of sections) {
      for (const row of chunk(s.items, 2)) {
        rows.push(row.map((it) => flat.push(it) - 1))
      }
    }
    return { flat, rows }
  }, [sections])

  const tabKey = flat.some((it) => it.key === focusKey) ? focusKey : flat[0]?.key

  // A preview never outlives the panel.
  useEffect(() => () => setLayoutPreview(null), [])

  /** Change mode: shows the slide in a hovered or focused layout; null puts it back. */
  const preview = (t: Template | null) => {
    if (mode !== 'change') return
    if (!t || !slide || layoutRef(t) === currentLayout) return setLayoutPreview(null)
    setLayoutPreview({ slideId: slide.id, slide: slideInLayout(slide, t).slide, name: t.name })
  }

  const activate = (t: Template | null) => {
    if (mode === 'change') {
      if (t && layoutRef(t) !== currentLayout) changeLayout(store, t)
      return
    }
    // An open text box keeps what was typed and closes before the slide is added.
    exitTextEditing(store)
    const { deck, selection } = store.getState()
    const r = addSlideFromTemplate(deck, selection.slideId, t)
    store.apply(() => r.deck, { selection: { slideId: r.slideId, ids: [] } })
  }

  const moveFocus = (to: number) => {
    const it = flat[to]
    if (!it) return
    setFocusKey(it.key)
    cardRefs.current.get(it.key)?.focus()
  }

  const onCardKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const r = rows.findIndex((row) => row.includes(index))
    const col = rows[r].indexOf(index)
    const toRow = (n: number) => {
      const row = rows[n]
      return row ? row[Math.min(col, row.length - 1)] : -1
    }
    const to =
      e.key === 'ArrowRight' ? index + 1
      : e.key === 'ArrowLeft' ? index - 1
      : e.key === 'ArrowDown' ? toRow(r + 1)
      : e.key === 'ArrowUp' ? toRow(r - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? flat.length - 1
      : null
    if (to === null) return
    e.preventDefault()
    if (to >= 0 && to < flat.length) moveFocus(to)
  }

  const jump = (id: ChipId) => {
    setChip(id)
    if (id === 'all') {
      if (bodyRef.current) bodyRef.current.scrollTop = 0
      return
    }
    sectionRefs.current.get(id)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }

  const chips: { id: ChipId; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'mine', label: 'Mine' }, ...GROUPS]
  const title = mode === 'add' ? 'Add slide' : 'Change layout'
  const indexOf = new Map(flat.map((it, i) => [it.key, i]))

  const renderCard = (it: Item) => {
    const i = indexOf.get(it.key)!
    const common = {
      tabIndex: it.key === tabKey ? (0 as const) : (-1 as const),
      buttonRef: (el: HTMLButtonElement | null) => {
        if (el) cardRefs.current.set(it.key, el)
        else cardRefs.current.delete(it.key)
      },
      onActivate: () => activate(it.template),
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onCardKey(e, i),
      onFocus: () => {
        setFocusKey(it.key)
        preview(it.template)
      },
      onPreview: (on: boolean) => preview(on ? it.template : null),
    }
    return it.template ? (
      <TemplateCard key={it.key} {...common} template={it.template} theme={theme} mode={mode} current={mode === 'change' && currentLayout === it.key} />
    ) : (
      <BlankCard key={it.key} {...common} />
    )
  }

  return (
    <aside
      className={styles.panel}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setLayoutPreview(null)
      }}
    >
      <div className={styles.head}>
        {mode === 'add' ? <LayoutTemplate size={16} strokeWidth={1.75} aria-hidden /> : <Replace size={16} strokeWidth={1.75} aria-hidden />}
        <span className={styles.title}>{title}</span>
        <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
      </div>
      <div ref={bodyRef} className={styles.body}>
        {mode === 'change' && <p className={styles.hint}>Your text and pictures move to the new layout.</p>}
        <TextField
          type="search"
          icon={Search}
          aria-label="Search slides"
          placeholder="Search slides"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.chips} role="group" aria-label="Groups">
          {chips.map((c) => (
            <button key={c.id} type="button" className={styles.chip} aria-pressed={chip === c.id} onClick={() => jump(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        {sections.map((s) => {
          const headingId = `${uid}-${s.id}`
          return (
            <section
              key={s.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(s.id, el)
                else sectionRefs.current.delete(s.id)
              }}
              className={styles.section}
            >
              {s.heading && (
                <h3 id={headingId} className={styles.heading}>
                  {s.heading}
                </h3>
              )}
              {s.items.length > 0 ? (
                <div
                  role="grid"
                  aria-labelledby={s.heading ? headingId : undefined}
                  aria-label={s.heading ? undefined : 'Blank slide'}
                  className={styles.grid}
                >
                  {chunk(s.items, 2).map((row) => (
                    <div role="row" key={row[0].key} className={styles.row}>
                      {row.map(renderCard)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>
                  <BookmarkPlus size={15} strokeWidth={1.75} aria-hidden />
                  <span>No templates yet. Save a slide from its menu, or import a file.</span>
                </p>
              )}
            </section>
          )
        })}
        {flat.length === 0 && <p className={styles.hint}>No slides match “{query.trim()}”.</p>}
      </div>
    </aside>
  )
}
