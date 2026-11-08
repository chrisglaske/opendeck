import {
  Bold,
  BringToFront,
  CheckCircle2,
  Copy,
  Group,
  Lock,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  Redo2,
  Search,
  SendToBack,
  Share,
  Sun,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogSurface,
  IconButton,
  Logo,
  Menu,
  MenuPreview,
  ModeSwitch,
  NumberField,
  SegmentedControl,
  Tabs,
  TextField,
  Toggle,
  ToastView,
  toast,
  type MenuItem,
} from '../ui'
import styles from './DesignSystemPage.module.css'

type Mode = 'light' | 'dark'
type Fit = 'fit' | 'fill' | 'crop'
const MODES: Mode[] = ['light', 'dark']

const SWATCHES: Record<string, [token: string, label: string][]> = {
  Surfaces: [
    ['bg', 'Page background'],
    ['surface', 'Card / panel'],
    ['subtle', 'Hover / subtle'],
    ['canvas', 'Editor canvas'],
  ],
  'Text & lines': [
    ['ink', 'Text'],
    ['muted', 'Secondary text'],
    ['faint', 'Hints, meta'],
    ['line-strong', 'Input border'],
  ],
  Accent: [
    ['accent', 'Fill'],
    ['accent-text', 'Small text, links'],
    ['accent-tint', 'Tint, selection'],
    ['peach', 'Highlight (rare)'],
  ],
  Status: [
    ['success', 'Success'],
    ['warning', 'Warning'],
    ['danger', 'Danger'],
    ['line', 'Divider'],
  ],
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'dup', label: 'Duplicate', icon: Copy, shortcut: '⌘D', onSelect: () => toast('Duplicated') },
  { id: 'fwd', label: 'Bring forward', icon: BringToFront, shortcut: '⌘]', onSelect: () => toast('Brought forward') },
  { id: 'back', label: 'Send backward', icon: SendToBack, shortcut: '⌘[', onSelect: () => toast('Sent backward') },
  { id: 'group', label: 'Group', icon: Group, shortcut: '⌘G', onSelect: () => toast('Grouped') },
  { id: 'lock', label: 'Lock', icon: Lock, onSelect: () => toast('Locked') },
  'separator',
  { id: 'del', label: 'Delete', icon: Trash2, shortcut: '⌫', danger: true, onSelect: () => toast('Deleted') },
]

function Section({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.h2}>{title}</h2>
      {intro && <p className={styles.intro}>{intro}</p>}
      {children}
    </section>
  )
}

/** Renders `children` once per mode, side by side, each forced to that mode. */
function ModePair({ name, children }: { name: string; children: (mode: Mode) => ReactNode }) {
  return (
    <div className={styles.pair}>
      {MODES.map((mode) => (
        <div key={mode} data-mode={mode} data-panel={name} className={styles.panel}>
          <div className={styles.ptitle}>
            {mode === 'light' ? <Sun size={16} strokeWidth={1.75} aria-hidden /> : <Moon size={16} strokeWidth={1.75} aria-hidden />}
            {mode === 'light' ? 'Light' : 'Dark'}
          </div>
          {children(mode)}
        </div>
      ))}
    </div>
  )
}

function LogoPanel() {
  return (
    <div className={styles.logos}>
      <Logo size={38} />
      <span className={styles.tile} style={{ background: 'var(--accent-tint)' }}>
        <Logo size={34} wordmark={false} />
      </span>
      {/* On an ink tile the front card takes the dark-mode violet, as in the mockup. */}
      <span className={styles.tile} style={{ background: 'var(--ink)' }}>
        <span data-mode="dark" className={styles.inline}>
          <Logo size={34} wordmark={false} />
        </span>
      </span>
      <Logo size={20} wordmark={false} />
      <span className={styles.caption}>wordmark · app icon · favicon (16–20px)</span>
    </div>
  )
}

/** Shows hex as #RRGGBB uppercase; the build minifier shortens and lowercases it. */
function toHex6(v: string): string {
  const m = /^#([0-9a-f]{3})$/i.exec(v)
  const hex = m ? `#${[...m[1]].map((c) => c + c).join('')}` : v
  return hex.startsWith('#') ? hex.toUpperCase() : hex
}

function ColorPanel() {
  const ref = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  // Read live values so the page cannot drift from tokens.css.
  useLayoutEffect(() => {
    const panel = ref.current?.closest<HTMLElement>('[data-mode]')
    if (!panel) return
    const cs = getComputedStyle(panel)
    const next: Record<string, string> = {}
    for (const items of Object.values(SWATCHES)) {
      for (const [token] of items) {
        const v = cs.getPropertyValue(`--${token}`).trim()
        next[token] = toHex6(v)
      }
    }
    setValues(next)
  }, [])

  return (
    <div ref={ref}>
      {Object.entries(SWATCHES).map(([group, items]) => (
        <div key={group} className={styles.group}>
          <div className={styles.groupname}>{group}</div>
          <div className={styles.swatches}>
            {items.map(([token, label]) => (
              <div key={token} className={styles.swatch} data-testid={`swatch-${token}`}>
                <i style={{ background: `var(--${token})` }} />
                <b>{label}</b>
                <code>
                  {token} · {values[token] ?? ''}
                </code>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const TYPE_ROWS: [meta: [string, string], sample: ReactNode][] = [
  [['Display · Manrope 800', '44 / 1.05 · −0.03em'], <div className={styles.display}>Make a deck you're proud of</div>],
  [['Heading 1 · Manrope 800', '28 / 1.2'], <div className={styles.th1}>Recent decks</div>],
  [['Heading 2 · Manrope 800', '20 / 1.3'], <div className={styles.th2}>Start something new</div>],
  [['Heading 3 · Inter 600', '15 / 1.4'], <div className={styles.th3}>Slide settings</div>],
  [['Body · Inter 400', '15 / 1.6'], <div className={styles.body}>Everything stays in your browser. No account, no upload, nothing leaves your computer.</div>],
  [['UI · Inter 400/500', '13 / 1.5'], <div className={styles.ui}>Bring forward · Send backward · Align left · Distribute horizontally</div>],
  [['Caption · Inter 400', '12 / 1.4'], <div className={styles.captionSample}>Edited 2 hours ago · 12 slides</div>],
  [['Overline · Inter 700', '11 · +0.1em · caps'], <div className={styles.eyebrow}>Folders</div>],
]

function TypePanel() {
  return (
    <div className={`${styles.panel} ${styles.type}`}>
      {TYPE_ROWS.map(([[a, b], sample]) => (
        <div key={a} className={styles.typeRow}>
          <div className={styles.meta}>
            {a}
            <br />
            {b}
          </div>
          {sample}
        </div>
      ))}
    </div>
  )
}

function ComponentsPanel({ mode }: { mode: Mode }) {
  const [tab, setTab] = useState('style')
  const [fit, setFit] = useState<Fit>('fit')
  const [snap, setSnap] = useState(true)
  const [grid, setGrid] = useState(false)
  const [lock, setLock] = useState(true)
  const [box, setBox] = useState({ x: 120, y: 84, w: 640, h: 180 })
  const [bold, setBold] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const suffix = mode === 'light' ? '' : ' (dark)'

  return (
    <div className={styles.stack}>
      <div>
        <span className={styles.lbl}>Buttons</span>
        <div className={styles.row}>
          <Button variant="primary" icon={Play}>Present</Button>
          <Button icon={Share}>Share</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger" icon={Trash2}>Delete</Button>
        </div>
        <div className={`${styles.row} ${styles.mt}`}>
          <Button variant="primary" size="sm" icon={Plus}>New deck</Button>
          <Button size="sm">Import</Button>
          <Button variant="primary" size="sm" disabled>Disabled</Button>
          <span className={styles.spacer} />
          <IconButton icon={Undo2} label="Undo" shortcut="⌘Z" />
          <IconButton icon={Redo2} label="Redo" shortcut="⇧⌘Z" />
          <IconButton icon={Bold} label="Bold" pressed={bold} onClick={() => setBold(!bold)} />
        </div>
      </div>

      <div>
        <span className={styles.lbl}>Fields</span>
        <TextField icon={Search} placeholder="Search decks, folders, tags" aria-label={`Search${suffix}`} />
        <TextField className={styles.mt} defaultValue="Q3 Board update" aria-label={`Deck name${suffix}`} />
        <div className={`${styles.num} ${styles.mt}`}>
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <NumberField
              key={k}
              prefix={k.toUpperCase()}
              label={`${{ x: 'X position', y: 'Y position', w: 'Width', h: 'Height' }[k]}${suffix}`}
              value={box[k]}
              min={k === 'w' || k === 'h' ? 1 : undefined}
              onChange={(v) => setBox((b) => ({ ...b, [k]: v }))}
            />
          ))}
        </div>
      </div>

      <div>
        <span className={styles.lbl}>Tabs · segmented · toggles</span>
        <Tabs
          label={`Inspector${suffix}`}
          tabs={[
            { id: 'style', label: 'Style' },
            { id: 'arrange', label: 'Arrange' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className={`${styles.row} ${styles.mt} ${styles.gap16}`}>
          <SegmentedControl<Fit>
            label={`Image fit${suffix}`}
            options={[
              { value: 'fit', label: 'Fit' },
              { value: 'fill', label: 'Fill' },
              { value: 'crop', label: 'Crop' },
            ]}
            value={fit}
            onChange={setFit}
          />
          <Toggle label="Snap" checked={snap} onChange={setSnap} />
          <Toggle label="Grid" checked={grid} onChange={setGrid} />
          <Checkbox label="Lock" checked={lock} onChange={setLock} />
        </div>
      </div>

      <div>
        <span className={styles.lbl}>Chips · tags · status</span>
        <div className={styles.row}>
          <Chip tone="accent">Beta</Chip>
          <Chip dot>Sales</Chip>
          <Chip tone="peach">New</Chip>
          <Chip tone="success" dot>Saved</Chip>
          <span className={styles.tip}>Duplicate · ⌘D</span>
        </div>
      </div>

      <div className={`${styles.row} ${styles.top} ${styles.gap16}`}>
        <div className={styles.stack} style={{ gap: 8 }}>
          <MenuPreview items={MENU_ITEMS} highlight="fwd" />
          <Menu
            label={`Element actions${suffix}`}
            items={MENU_ITEMS}
            trigger={
              <Button variant="ghost" size="sm" icon={MoreHorizontal}>
                Try the menu
              </Button>
            }
          />
        </div>
        <div className={styles.stack} style={{ flex: 1, gap: 12 }}>
          <DialogSurface
            title={'Delete "Q3 Board update"?'}
            description="This removes the deck from this browser. Export it first if you want a copy."
            actions={
              <>
                <Button variant="ghost" size="sm">Cancel</Button>
                <Button variant="danger" size="sm">Delete deck</Button>
              </>
            }
          />
          <ToastView icon={CheckCircle2} message="Theme applied to 12 slides" actionLabel="Undo" />
          <div className={styles.row}>
            <Button size="sm" onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button size="sm" onClick={() => toast('Theme applied to 12 slides', { actionLabel: 'Undo' })}>
              Show toast
            </Button>
          </div>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title={'Delete "Q3 Board update"?'}
            description="This removes the deck from this browser. Export it first if you want a copy."
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDialogOpen(false)
                    toast('Deck deleted (demo)')
                  }}
                >
                  Delete deck
                </Button>
              </>
            }
          />
        </div>
      </div>
    </div>
  )
}

export default function DesignSystemPage() {
  return (
    <>
      <header className={styles.topbar}>
        <div className={`${styles.wrap} ${styles.topInner}`}>
          <Logo />
          <span className={styles.note}>Design system · Stage 1</span>
          <span className={styles.spacer} />
          <ModeSwitch />
        </div>
      </header>
      <main className={styles.wrap}>
        <Section
          eyebrow="1 · Logo"
          title="Logo and app icon"
          intro="Two fanned cards (peach behind, violet in front) and the wordmark in Manrope 800. In dark mode the front card uses the lighter violet so it doesn't sink into the background."
        >
          <ModePair name="logo">{() => <LogoPanel />}</ModePair>
        </Section>
        <Section
          eyebrow="2 · Color"
          title="Color tokens, light and dark"
          intro={
            <>
              One set of token names, two sets of values. Dark mode is <b>Graphite</b>: neutral greys with no tint, not
              pure black. <b>accent</b> is for fills (buttons, selection); <b>accent-text</b> is the darker/lighter violet used
              for small text and links so it passes WCAG AA. These colors are only for the app around the slides. Slides
              take their colors from the deck theme.
            </>
          }
        >
          <ModePair name="color">{() => <ColorPanel />}</ModePair>
        </Section>
        <Section
          eyebrow="3 · Type"
          title="Type scale"
          intro="Manrope 800 for the logo and headings, Inter for everything else. Editor chrome runs at 13px so the canvas gets the space; reading text runs at 15px."
        >
          <TypePanel />
        </Section>
        <Section
          eyebrow="4 · Components"
          title="Core components, side by side"
          intro="The building blocks every screen is made from. Left is light mode, right is dark mode, same components."
        >
          <ModePair name="components">{(mode) => <ComponentsPanel mode={mode} />}</ModePair>
        </Section>
      </main>
    </>
  )
}

