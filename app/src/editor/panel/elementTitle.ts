import { Circle, Group, Image, Minus, Smile, Square, Stamp, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SlideElement } from '../../model/types'

/** The icon and name the panel, layer list and menus use for an element. */
export function elementTitle(el: SlideElement): { icon: LucideIcon; label: string } {
  switch (el.type) {
    case 'text': return { icon: Type, label: 'Text' }
    case 'shape':
      if (el.shape === 'ellipse') return { icon: Circle, label: 'Ellipse' }
      return { icon: Square, label: el.radius === 'theme' || el.radius > 0 ? 'Rounded rectangle' : 'Rectangle' }
    case 'image': return { icon: Image, label: 'Image' }
    case 'icon': return { icon: Smile, label: 'Icon' }
    case 'logo': return { icon: Stamp, label: 'Logo' }
    case 'line': return { icon: Minus, label: 'Line' }
    case 'group': return { icon: Group, label: 'Group' }
  }
}
