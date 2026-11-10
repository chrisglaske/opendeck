import { useState } from 'react'
import { ConsentCard } from './ConsentCard'
import { FeatureStrip } from './FeatureStrip'
import { Footer } from './Footer'
import { Hero } from './Hero'
import { MoveDemo } from './MoveDemo'
import { PresentShare } from './PresentShare'
import { PrivacyDialog } from './PrivacyDialog'
import { TemplateGallery } from './TemplateGallery'
import { TopBar } from './TopBar'
import { WhyPrivate } from './WhyPrivate'
import styles from './LandingPage.module.css'

/** The start page for new visitors: what OpenDeck is, shown with real slides. */
export default function LandingPage() {
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [answered, setAnswered] = useState(false)
  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <TopBar />
      <main>
        <Hero />
        <FeatureStrip />
        <section id="templates" className={styles.sec} aria-labelledby="templates-h">
          <div className={styles.in}>
            <p className={styles.eyebrow}>Templates</p>
            <h2 id="templates-h" className={styles.h2}>Start with a slide that already looks right.</h2>
            <p className={styles.sub}>Pick one and type over the sample text. They all work with every theme.</p>
            <TemplateGallery />
          </div>
        </section>
        <MoveDemo />
        <PresentShare />
        <WhyPrivate />
      </main>
      <Footer onPrivacy={() => setPrivacyOpen(true)} />
      {privacyOpen && <PrivacyDialog open onClose={() => setPrivacyOpen(false)} onAnswer={() => setAnswered(true)} />}
      <ConsentCard hidden={answered} />
    </div>
  )
}
