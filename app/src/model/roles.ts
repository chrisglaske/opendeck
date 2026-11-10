/**
 * Content roles on template elements. A role says what an element holds (a title, the second
 * number, the third person's photo) so a layout switch can move it to the matching spot.
 */
import type { SlideElement } from './types'

const BASES = [
  'decor', 'title', 'overline', 'subtitle', 'body', 'caption', 'quote', 'author', 'author.role', 'code', 'number', 'text', 'picture',
  'stat.value', 'stat.label', 'person.name', 'person.role', 'person.bio', 'person.photo', 'item.title', 'item.body', 'item.value', 'item.icon',
]

/** A known role, optionally numbered 1–99: `title`, `stat.value[2]`. */
export const ROLE = new RegExp(`^(?:${BASES.map((b) => b.replace('.', '\\.')).join('|')})(?:\\[[1-9][0-9]?\\])?$`)

export function parseRole(role: string): { base: string; index: number } {
  const m = /^(.*?)(?:\[(\d+)\])?$/.exec(role)!
  return { base: m[1], index: m[2] ? Number(m[2]) : 0 }
}

const ITEM_PARTS = ['stat', 'person', 'item']

/** Which kept item a role belongs to: a number and its label count as one, as do a person's name, role and photo. */
export function itemKey(role: string): string {
  const { base, index } = parseRole(role)
  const head = base.split('.')[0]
  if (index > 0 && ITEM_PARTS.includes(head) && base.includes('.')) return `${head}[${index}]`
  return role
}

/** A copy without template marks, at every depth: a copied element is the person's own. */
export function asOwnElement<T extends SlideElement>(el: T): T {
  const { role: _r, aside: _a, sample: _s, ...rest } = el as SlideElement & { sample?: true }
  if (rest.type === 'group') return { ...rest, children: rest.children.map(asOwnElement) } as unknown as T
  // A copy of a sample picture is an empty frame for the person's own photo, not more drawn sample art.
  if (rest.type === 'image' && rest.art) {
    const { art: _art, ...plain } = rest
    return plain as unknown as T
  }
  return rest as unknown as T
}
