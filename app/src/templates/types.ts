import type { Slide, SlideElement } from '../model/types'

export type TemplateGroup =
  | 'titles' | 'sections' | 'text' | 'images' | 'numbers' | 'people' | 'timelines' | 'compare' | 'quotes' | 'tech' | 'teaching' | 'closing'

/** Built-in groups in the order the Slides panel shows them. */
export const GROUPS: readonly { id: TemplateGroup; label: string }[] = [
  { id: 'titles', label: 'Titles' },
  { id: 'sections', label: 'Sections' },
  { id: 'text', label: 'Text' },
  { id: 'images', label: 'Images' },
  { id: 'numbers', label: 'Numbers' },
  { id: 'people', label: 'People' },
  { id: 'timelines', label: 'Timelines' },
  { id: 'compare', label: 'Compare' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'tech', label: 'Tech' },
  { id: 'teaching', label: 'Teaching' },
  { id: 'closing', label: 'Closing' },
]

export const groupLabel = (g: TemplateGroup | 'mine') => (g === 'mine' ? 'My templates' : GROUPS.find((x) => x.id === g)?.label ?? '')

/** One slide's worth of ordinary elements that follow the theme. `group: 'mine'` marks the person's own. */
export type Template = {
  id: string
  name: string
  group: TemplateGroup | 'mine'
  keywords: string[]
  /** Position within its group. */
  order: number
  slide: { background: Slide['background']; elements: SlideElement[] }
  createdAt: number
  updatedAt: number
}

/** How a slide remembers its template: `builtin:<id>` or `mine:<id>`. */
export function layoutRef(t: Template): string {
  return `${t.group === 'mine' ? 'mine' : 'builtin'}:${t.id}`
}
