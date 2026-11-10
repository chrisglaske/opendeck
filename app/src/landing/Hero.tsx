import { CodeXml, Lock, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BUILTIN_THEMES } from '../model/builtinThemes'
import { Button } from '../ui'
import { CrossfadeSlide } from './CrossfadeSlide'
import { goMakeDeck, scrollToSection } from './smallScreen'
import { heroSlide } from './slides'
import { ThemeChips } from './ThemeChips'
import page from './LandingPage.module.css'
import styles from './Hero.module.css'

export function Hero() {
  const slide = useMemo(heroSlide, [])
  const [themeId, setThemeId] = useState(BUILTIN_THEMES[0].id)
  const theme = BUILTIN_THEMES.find((t) => t.id === themeId) ?? BUILTIN_THEMES[0]
  return (
    <div className={styles.grid}>
      <div>
        <span className={styles.pill}>Free · open source · no sign-up</span>
        <h1 className={styles.h}>
          Good-looking decks, <em>without the fuss.</em>
        </h1>
        <p className={styles.lede}>
          Pick a template, type over it, and try a different look in one click. Your decks stay on your computer.
        </p>
        <div className={styles.ctas}>
          <Button variant="primary" className={page.lg} onClick={goMakeDeck}>Make a deck</Button>
          <Button className={page.lg} onClick={() => scrollToSection('templates')}>See templates</Button>
        </div>
        <ul className={styles.trust} aria-label="Why it's safe to try">
          <li><UserX className={page.ico} aria-hidden />No account</li>
          <li><Lock className={page.ico} aria-hidden />Stays on your computer</li>
          <li><CodeXml className={page.ico} aria-hidden />Open source</li>
        </ul>
      </div>
      <div className={styles.show}>
        <CrossfadeSlide slide={slide} theme={theme} className={styles.heroFrame} />
        <div className={styles.chips}>
          <span aria-hidden>Try a theme:</span>
          <ThemeChips value={themeId} onChange={setThemeId} />
        </div>
      </div>
    </div>
  )
}
