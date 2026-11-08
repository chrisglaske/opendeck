import { Palette } from 'lucide-react'

// Minimal placeholder; Task 7 builds the full page.
export default function DesignSystemPage() {
  return (
    <main>
      <h1>
        <Palette size={16} strokeWidth={1.75} aria-hidden /> Design system
      </h1>
      <p>Tokens and components for OpenDeck V2.</p>
    </main>
  )
}
