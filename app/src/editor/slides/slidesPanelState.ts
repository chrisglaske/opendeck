import { createContext, useContext } from 'react'

/**
 * Whether the Slides panel is open, and how to open or close it. Shared by the rail, the dock
 * (Add slide) and the Slide tab (Change layout).
 */
export type SlidesPanelState = { open: boolean; toggle(): void; changeLayout(): void }

export const SlidesPanelContext = createContext<SlidesPanelState>({ open: false, toggle: () => {}, changeLayout: () => {} })

export const useSlidesPanel = () => useContext(SlidesPanelContext)
