import { LayoutTemplate, Lock, Move, Palette } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import styles from './LandingPage.module.css'

const ITEMS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: LayoutTemplate, title: 'Templates to start from', text: 'Ready-made slides for pitches, reviews, talks and lessons. Just type over them.' },
  { icon: Palette, title: 'Themes in one click', text: 'Try a different look for the whole deck, or set up your own colors and logo.' },
  { icon: Move, title: 'Move anything', text: 'Drag things around and resize them. Guides help you line them up.' },
  { icon: Lock, title: 'Private', text: 'No account, nothing uploaded. Your decks live in your browser.' },
]

export function FeatureStrip() {
  return (
    <section id="features" className={styles.in} aria-label="Features">
      <ul className={styles.strip}>
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <span className={styles.fi}><Icon className={styles.ico} aria-hidden /></span>
            <b>{title}</b>
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
