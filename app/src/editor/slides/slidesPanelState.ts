import { createContext, useContext } from 'react'

/**
 * Whether the Slides panel is open, and how to open or close it. Shared by the rail, the dock
 * (Add slide) and the Slide tab (Change layout), and by the slide menus (Save slide as template).
 */
export type SlidesPanelState = {
  open: boolean
  toggle(): void
  changeLayout(): void
  /** Opens "Save as template" for one slide. */
  saveAsTemplate(slideId: string): void
}

export const SlidesPanelContext = createContext<SlidesPanelState>({
  open: false,
  toggle: () => {},
  changeLayout: () => {},
  saveAsTemplate: () => {},
})

export const useSlidesPanel = () => useContext(SlidesPanelContext)
