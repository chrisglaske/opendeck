import { deleteElements, duplicateElements, group, reorder, ungroup, updateElements } from '../model/ops'
import type { ReorderDir } from '../model/ops'
import type { Slide } from '../model/types'
import type { EditorStore } from './store'
import { worldItems } from './canvas/world'
import { getEditorMode } from './mode/editorMode'

function current(store: EditorStore) {
  const st = store.getState()
  const slide: Slide = st.deck.slides.find((s) => s.id === st.selection.slideId) ?? st.deck.slides[0]
  return { slide, slideId: slide.id, ids: st.selection.ids }
}

/** What the selection allows, for menus and quick bars. */
export function selectionInfo(slide: Slide, ids: string[]) {
  const items = worldItems(slide, ids)
  const topLevel = ids.filter((id) => slide.elements.some((e) => e.id === id))
  return {
    count: items.length,
    canGroup: topLevel.length >= 2 && topLevel.length === ids.length,
    canUngroup: slide.elements.some((e) => e.type === 'group' && ids.includes(e.id)),
    allLocked: items.length > 0 && items.every((i) => i.el.locked),
    /** Nothing selected can be moved or deleted in Simple: locked itself, inside a locked group, or holding a locked item. */
    held: items.length > 0 && items.every((i) => i.locked),
  }
}

/**
 * The selection that may be duplicated, deleted or reordered. In Simple mode a
 * locked item stays where it is, so it is left out.
 */
function movable(store: EditorStore) {
  const c = current(store)
  if (getEditorMode() !== 'simple') return c
  return { ...c, ids: worldItems(c.slide, c.ids).filter((i) => !i.locked).map((i) => i.id) }
}

/** Element commands on the current selection. Each is one undo step and keeps a sensible selection. */
export function elementCommands(store: EditorStore) {
  return {
    duplicate() {
      const { slideId, ids } = movable(store)
      if (!ids.length) return
      const r = duplicateElements(store.getState().deck, slideId, ids)
      store.apply(() => r.deck, { selection: { slideId, ids: r.ids } })
    },
    group() {
      const { slide, slideId, ids } = current(store)
      if (!selectionInfo(slide, ids).canGroup) return
      const r = group(store.getState().deck, slideId, ids)
      if (r.groupId) store.apply(() => r.deck, { selection: { slideId, ids: [r.groupId] } })
    },
    ungroup() {
      const { slide, slideId, ids } = current(store)
      const groups = slide.elements.filter((e) => e.type === 'group' && ids.includes(e.id)).map((e) => e.id)
      if (!groups.length) return
      let deck = store.getState().deck
      const freed: string[] = []
      for (const g of groups) {
        const r = ungroup(deck, slideId, g)
        deck = r.deck
        freed.push(...r.ids)
      }
      const rest = ids.filter((id) => !groups.includes(id))
      store.apply(() => deck, { selection: { slideId, ids: [...rest, ...freed] } })
    },
    reorder(dir: ReorderDir) {
      const { slideId, ids } = movable(store)
      if (ids.length) store.apply((d) => reorder(d, slideId, ids, dir))
    },
    /** Locks the selection, or unlocks it when everything in it is already locked. */
    toggleLock() {
      const { slide, slideId, ids } = current(store)
      if (!ids.length) return
      const lock = !selectionInfo(slide, ids).allLocked
      store.apply((d) => updateElements(d, slideId, ids, (e) => (e.locked === lock ? e : { ...e, locked: lock })))
    },
    remove() {
      const { slideId, ids } = movable(store)
      if (ids.length) store.apply((d) => deleteElements(d, slideId, ids), { selection: { slideId, ids: [] } })
    },
  }
}
