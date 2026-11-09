import type { TextStyleId } from '../../model/types'

/** The theme's text styles, in the order they are offered. */
export const TEXT_STYLES: { id: TextStyleId; name: string }[] = [
  { id: 'title', name: 'Title' },
  { id: 'heading', name: 'Heading' },
  { id: 'body', name: 'Body' },
  { id: 'caption', name: 'Caption' },
]
