/** Phones and narrow windows, where the editor isn't offered. Matches the landing page's phone layout. */
export const SMALL_SCREEN = '(max-width: 759px)'

export function isSmallScreen(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(SMALL_SCREEN).matches
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Every "Make a deck": Home's start grid on a computer, the "needs a computer" note on a phone. */
export function goMakeDeck(): void {
  window.location.hash = isSmallScreen() ? '#/computer' : '#/home'
}

/** Scrolls to a section of the landing page without touching the address (the app routes on it). */
export function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}
