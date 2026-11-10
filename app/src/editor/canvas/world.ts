import { bounds, childToParent, moveElement, rotateAround } from '../../model/geometry'
import { findElement } from '../../model/ops'
import type { GroupEl, Slide, SlideElement } from '../../model/types'

/**
 * An element in slide coordinates, with the way back to the coordinates it is
 * stored in. Top-level elements are unchanged; group children are converted
 * through every group they sit in.
 */
export type WorldItem = {
  id: string
  el: SlideElement
  /** True when the element, any group around it, or (for a group) anything inside it is locked. */
  locked: boolean
  /** The id of the group the element sits in, or null at the top level. */
  parentId: string | null
  toLocal(world: SlideElement): SlideElement
}

function parentToChild<T extends SlideElement>(el: T, g: GroupEl): T {
  const turned = g.rotation % 360 === 0 ? el : rotateAround(el, { x: g.x + g.w / 2, y: g.y + g.h / 2 }, -g.rotation)
  return moveElement(turned, -g.x, -g.y)
}

const holdsLocked = (el: SlideElement): boolean => el.type === 'group' && el.children.some((c) => c.locked || holdsLocked(c))

export function worldItem(slide: Slide, id: string): WorldItem | null {
  const found = findElement(slide, id)
  if (!found) return null
  // Groups from the top level down, each in its own parent's coordinates.
  const groups = found.path.map((gid, i) => {
    const parent = i === 0 ? slide.elements : (findElement(slide, found.path[i - 1])!.el as GroupEl).children
    return parent.find((e) => e.id === gid) as GroupEl
  })
  let el = found.el
  for (let i = groups.length - 1; i >= 0; i--) el = childToParent(el, groups[i])
  return {
    id,
    el,
    locked: found.el.locked || groups.some((g) => g.locked) || holdsLocked(found.el),
    parentId: groups.length ? groups[groups.length - 1].id : null,
    toLocal(world) {
      let local = world
      for (const g of groups) local = parentToChild(local, g)
      return local
    },
  }
}

export function worldItems(slide: Slide, ids: string[]): WorldItem[] {
  return ids.map((id) => worldItem(slide, id)).filter((x): x is WorldItem => x !== null)
}

/** Bounds of the top-level elements that neither are nor contain one of `ids`: what a drag can snap to. */
export function snapTargets(slide: Slide, ids: string[]) {
  return slide.elements
    .filter((e) => !ids.some((id) => id === e.id || (e.type === 'group' && findElement({ ...slide, elements: [e] }, id))))
    .map(bounds)
}
