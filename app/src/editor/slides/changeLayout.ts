import { knownImageSize } from '../../storage/assets'
import { myTemplate } from '../../storage/templates'
import { templateByRef } from '../../templates/builtins'
import { switchLayout } from '../../templates/switchLayout'
import type { Template } from '../../templates/types'
import type { Deck, Slide } from '../../model/types'
import { toast } from '../../ui'
import { exitTextEditing } from '../canvas/textSession'
import type { EditorStore } from '../store'
import { setLayoutPreview } from './layoutPreview'

const replaceSlide = (d: Deck, s: Slide): Deck => ({ ...d, slides: d.slides.map((x) => (x.id === s.id ? s : x)) })

/** The current slide switched to a template's layout, for previews and for the switch itself. */
export function slideInLayout(slide: Slide, t: Template) {
  return switchLayout(slide, t, knownImageSize)
}

/** Switches the current slide to a template's layout as one undo step, keeping any text being typed. */
export function changeLayout(store: EditorStore, t: Template) {
  exitTextEditing(store)
  setLayoutPreview(null)
  const { deck, selection } = store.getState()
  const before = deck.slides.find((s) => s.id === selection.slideId)
  if (!before) return
  const { slide, kept } = slideInLayout(before, t)
  store.apply((d) => replaceSlide(d, slide), { selection: { slideId: slide.id, ids: [] } })
  const after = store.getState().deck
  // The toast's Undo takes back this switch only. When something was done since, the slide is
  // switched back to its old layout as a new step, so anything typed meanwhile moves along with it.
  const previous = templateByRef(before.layout, myTemplate)
  const undo = () => {
    if (store.getState().deck === after) return store.undo()
    const now = store.getState().deck.slides.find((s) => s.id === before.id)
    if (!now) return
    store.apply((d) => replaceSlide(d, previous ? slideInLayout(now, previous).slide : before))
  }
  const note = kept === 0 ? '' : kept === 1 ? ' · 1 item kept beside the slide' : ` · ${kept} items kept beside the slide`
  toast(`Switched to ${t.name}${note}`, { actionLabel: 'Undo', onAction: undo })
}
