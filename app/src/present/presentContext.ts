import { createContext, useContext } from 'react'
import type { ShowStart } from './PresentSession'

/** Starts a show of the open deck. Provided by the editor page; null outside it. */
export const PresentContext = createContext<((start: ShowStart) => void) | null>(null)

export const useStartShow = () => useContext(PresentContext)
