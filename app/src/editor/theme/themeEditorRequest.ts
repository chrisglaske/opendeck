import { createContext, useContext } from 'react'

/** Opens the deck's theme editor ("This deck's theme"). Provided by the editor shell. */
export const OpenDeckThemeContext = createContext<() => void>(() => {})

export const useOpenDeckTheme = () => useContext(OpenDeckThemeContext)
