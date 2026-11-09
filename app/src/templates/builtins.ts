/**
 * The built-in templates: every JSON file in `./builtin`, checked like any template file.
 * Adding a built-in means adding its file here and nothing else.
 */
import { sanitizeTemplateData } from './templateData'
import { GROUPS } from './types'
import type { Template } from './types'

const files = import.meta.glob('./builtin/*.json', { eager: true, import: 'default' })

function load(): Template[] {
  const out: Template[] = []
  for (const [path, raw] of Object.entries(files)) {
    const r = sanitizeTemplateData(raw)
    if (!r.ok || r.repaired > 0) {
      const why = r.ok ? `${r.repaired} repairs` : r.reason
      if (import.meta.env.DEV || import.meta.env.MODE === 'test') throw new Error(`Built-in template ${path} is not valid (${why})`)
      continue
    }
    out.push(r.template)
  }
  const rank = (t: Template) => GROUPS.findIndex((g) => g.id === t.group)
  return out.sort((a, b) => rank(a) - rank(b) || a.order - b.order)
}

export const BUILTIN_TEMPLATES: readonly Template[] = load()
const BY_ID = new Map(BUILTIN_TEMPLATES.map((t) => [t.id, t]))

export function builtinTemplate(id: string): Template | undefined {
  return BY_ID.get(id)
}

/** The template a layout ref names, if it still exists. `mine` looks up the person's own templates. */
export function templateByRef(ref: string | undefined, mine: (id: string) => Template | undefined): Template | undefined {
  if (!ref) return undefined
  const i = ref.indexOf(':')
  const kind = ref.slice(0, i), id = ref.slice(i + 1)
  if (kind === 'builtin') return builtinTemplate(id)
  if (kind === 'mine') return mine(id)
  return undefined
}
