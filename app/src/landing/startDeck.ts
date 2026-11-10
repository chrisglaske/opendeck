import { builtinTheme } from '../model/builtinThemes'
import { createDeck } from '../model/factory'
import { applyTheme } from '../model/themeOps'
import type { Deck } from '../model/types'
import { builtinTemplate } from '../templates/builtins'
import { slideFromTemplate } from '../templates/instantiate'

/** A new deck holding one slide from a built-in template, in a built-in theme. */
export function deckFromTemplate(templateId: string, themeId: string): Deck {
  const t = builtinTemplate(templateId)
  const theme = builtinTheme(themeId)
  if (!t || !theme) throw new Error(`Unknown template or theme: ${templateId} / ${themeId}`)
  return applyTheme({ ...createDeck(), slides: [slideFromTemplate(t)] }, theme)
}
