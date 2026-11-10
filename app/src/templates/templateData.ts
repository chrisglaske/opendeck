/**
 * The template file format, shared by built-ins and `.odtemplate` files. Everything goes
 * through the same checks as any outside data.
 */
import { sanitizeSlideContent } from '../model/sanitize'
import { GROUPS } from './types'
import type { Template, TemplateGroup } from './types'

export const TEMPLATE_FORMAT = 'opendeck-template'
export const TEMPLATE_VERSION = 1

const NAME_MAX = 200
const KEYWORDS_MAX = 20
const KEYWORD_LEN = 40
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

export type TemplateDataResult = { ok: true; template: Template; repaired: number } | { ok: false; reason: 'not-a-template' | 'newer-version' }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

export function sanitizeTemplateData(raw: unknown): TemplateDataResult {
  if (!isObj(raw) || raw.format !== TEMPLATE_FORMAT) return { ok: false, reason: 'not-a-template' }
  if (typeof raw.version === 'number' && raw.version > TEMPLATE_VERSION) return { ok: false, reason: 'newer-version' }
  if (!isObj(raw.template)) return { ok: false, reason: 'not-a-template' }
  const t = raw.template
  let repaired = raw.version === TEMPLATE_VERSION ? 0 : 1
  const fix = () => { repaired++ }

  const id = typeof t.id === 'string' && SAFE_ID.test(t.id) ? t.id : (fix(), 'template')
  let name = typeof t.name === 'string' ? t.name.trim() : (fix(), '')
  if (name.length > NAME_MAX) { fix(); name = name.slice(0, NAME_MAX) }
  if (!name) name = 'Untitled template'
  const groups: string[] = [...GROUPS.map((g) => g.id), 'mine']
  const group = (typeof t.group === 'string' && groups.includes(t.group) ? t.group : (fix(), 'mine')) as TemplateGroup | 'mine'
  const keywords: string[] = []
  if (t.keywords !== undefined) {
    if (!Array.isArray(t.keywords)) fix()
    else for (const k of t.keywords) {
      if (typeof k === 'string' && k.length > 0 && k.length <= KEYWORD_LEN && keywords.length < KEYWORDS_MAX) keywords.push(k)
      else fix()
    }
  }
  const num = (v: unknown) => (v === undefined ? 0 : typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : (fix(), 0))
  const content = sanitizeSlideContent(t.slide)
  repaired += content.repaired

  return {
    ok: true,
    repaired,
    template: {
      id, name, group, keywords, order: num(t.order),
      slide: { background: content.background, elements: content.elements },
      createdAt: num(t.createdAt), updatedAt: num(t.updatedAt),
    },
  }
}
