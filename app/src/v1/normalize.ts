/**
 * Reads V1's data the way V1 itself does: a faithful port of `js/storage.js`
 * (`migrateProjectsDatabase` and `normalizeSlide`), with the same defaults. Nothing is ever
 * written back; V1's keys are only read.
 */
import type { V1Folder, V1Project, V1Settings, V1Slide } from './types'

export const V1_PROJECTS_KEY = 'openDeckDB_v2'
export const V1_FOLDERS_KEY = 'openDeckFolders_v1'
const STORAGE_SCHEMA_VERSION = 3

/** The settings V1 fills in for everyone. A value equal to these counts as not set. */
export const V1_DEFAULTS = {
  theme: '#3B82F6',
  font: "'Inter', sans-serif",
  headerText: 'OpenDeck',
  headerIcon: 'OD',
  companyLogo: '',
} as const

const VALID_TRANSITIONS = new Set(['fade-in', 'slide-up', 'zoom-in', 'reveal-right'])
const VALID_BACKGROUNDS = new Set(['bg-default', 'bg-deepblue', 'bg-midnight', 'bg-aurora', 'bg-sunset', 'bg-pitchblack', 'bg-purewhite'])

type Obj = Record<string, unknown>
/** V1's own test: `x && typeof x === 'object'` (so arrays pass too). */
const isObject = (v: unknown): v is Obj => !!v && typeof v === 'object'
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const field = (o: unknown, k: string): unknown => (isObject(o) ? o[k] : undefined)

function defaultBgForType(type: string): string {
  if (type === 'glass_intro' || type === 'comparison') return 'bg-aurora'
  if (type === 'showcase_window') return 'bg-deepblue'
  if (type === 'roadmap_cards') return 'bg-sunset'
  if (type === 'corp_title' || type === 'corp_basic') return 'bg-purewhite'
  return 'bg-default'
}

const madeUpSlideId = (index: number) => 'slide_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + index

function normalizeSlide(slide: unknown, index: number): V1Slide {
  const out: Obj = isObject(slide) ? { ...slide } : {}
  out.id = str(out.id, madeUpSlideId(index))
  out.type = str(out.type, 'intro')
  out.navName = str(out.navName, `Slide ${index + 1}`)
  out.title = str(out.title, 'Main Topic Heading')
  out.notes = str(out.notes, '')
  out.transition = VALID_TRANSITIONS.has(out.transition as string) ? out.transition : 'fade-in'
  out.bgOverride = VALID_BACKGROUNDS.has(out.bgOverride as string) ? out.bgOverride : defaultBgForType(out.type as string)

  if (out.type === 'glass_intro') {
    out.kicker = str(out.kicker, 'Presentation System')
    out.subtitle = str(out.subtitle, '')
    out.icon = str(out.icon, 'fa-wand-magic-sparkles')
    const badge = (b: unknown) => ({
      text: str(field(b, 'text'), 'Badge'),
      icon: str(field(b, 'icon'), 'fa-star'),
      color: str(field(b, 'color'), '#3B82F6'),
    })
    const legacyTags = arr(out.tags).map(badge)
    out.badges = arr(out.badges).map(badge)
    if (!(out.badges as unknown[]).length && legacyTags.length) out.badges = legacyTags
  }

  if (out.type === 'pitch_stats') {
    out.subtitle = str(out.subtitle, '')
    out.stats = arr(out.stats).map((s) => ({
      value: str(field(s, 'value'), '100'),
      label: str(field(s, 'label'), 'Metric'),
      color: str(field(s, 'color'), '#3B82F6'),
    }))
    if (!(out.stats as unknown[]).length) {
      out.stats = [
        { value: '99%', label: 'Uptime', color: '#3B82F6' },
        { value: '10x', label: 'Growth', color: '#10B981' },
      ]
    }
  }

  if (out.type === 'grid') {
    out.subtitle = str(out.subtitle, '')
    out.cards = arr(out.cards).map((c) => ({
      title: str(field(c, 'title'), 'Feature'),
      text: str(field(c, 'text'), 'Description'),
      icon: str(field(c, 'icon'), 'fa-star'),
      color: str(field(c, 'color'), '#3B82F6'),
      image: str(field(c, 'image'), ''),
    }))
  }

  if (out.type === 'split') {
    out.subtitle = str(out.subtitle, '')
    out.bullets = arr(out.bullets).map((b) => str(b, ''))
    out.boxTitle = str(out.boxTitle, 'Key Takeaway')
    out.boxText = str(out.boxText, '')
    out.boxIcon = str(out.boxIcon, 'fa-lightbulb')
    out.image = str(out.image, '')
  }

  return out as V1Slide
}

/**
 * V1's projects after V1's own migrations, without writing anything back. Projects with an id
 * seen earlier in the list are left out (the first one wins).
 */
export function normalizeV1Projects(raw: unknown): V1Project[] {
  const seen = new Set<string>()
  return arr(raw)
    .filter(isObject)
    .map((project, projectIndex) => {
      const p: Obj = { ...project }
      const data: Obj = isObject(p.data) ? { ...p.data } : {}

      p.id = str(p.id, 'proj_' + Date.now() + '_' + projectIndex)
      p.name = str(p.name, 'Untitled Presentation')
      p.lastModified = Number.isFinite(p.lastModified) ? p.lastModified : Date.now()
      p.tags = arr(p.tags).map((t) => str(t, '')).filter(Boolean)

      data.slides = arr(data.slides).map((s, i) => normalizeSlide(s, i))
      data.slideCounter = Number.isFinite(data.slideCounter) ? data.slideCounter : (data.slides as unknown[]).length

      const gs: Obj = isObject(data.globalSettings) ? { ...data.globalSettings } : {}
      gs.theme = str(gs.theme, V1_DEFAULTS.theme)
      gs.font = str(gs.font, V1_DEFAULTS.font)
      gs.headerText = str(gs.headerText, V1_DEFAULTS.headerText)
      gs.headerIcon = str(gs.headerIcon, V1_DEFAULTS.headerIcon)
      gs.customFontUrl = str(gs.customFontUrl, '')
      gs.customFontFamily = str(gs.customFontFamily, '')
      gs.companyLogo = str(gs.companyLogo, V1_DEFAULTS.companyLogo)
      gs.savedFonts = arr(gs.savedFonts).filter(isObject)
      data.globalSettings = gs as V1Settings

      if (!(data.slides as unknown[]).length) {
        data.slides = [normalizeSlide({ type: 'glass_intro', navName: 'Welcome', title: 'New Presentation', subtitle: 'Start building your story here.' }, 0)]
        data.slideCounter = 1
      }
      p.data = data

      const version = Number.isFinite(p.schemaVersion) ? (p.schemaVersion as number) : 0
      if (version < STORAGE_SCHEMA_VERSION) p.schemaVersion = STORAGE_SCHEMA_VERSION
      return p as V1Project
    })
    .filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
}

function parse(text: string | null): unknown {
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** V1's projects and folders; null when V1 has no projects key (or storage can't be read). Never writes. */
export function readV1Storage(ls: Pick<Storage, 'getItem'>): { projects: V1Project[]; folders: V1Folder[] } | null {
  try {
    const projectsText = ls.getItem(V1_PROJECTS_KEY)
    if (projectsText === null) return null
    const folders = arr(parse(ls.getItem(V1_FOLDERS_KEY)))
      .filter((f): f is Obj => isObject(f) && typeof f.id === 'string' && typeof f.name === 'string')
      .map((f) => ({ id: f.id as string, name: f.name as string }))
    return { projects: normalizeV1Projects(parse(projectsText)), folders }
  } catch {
    return null
  }
}
