import { RefreshCw } from 'lucide-react'
import { Component } from 'react'
import type { ReactNode } from 'react'
import { Button, Logo } from '../ui'
import styles from './LoadErrorBoundary.module.css'

/** `resetKey`: going somewhere else (a new address) tries again. */
type Props = { children: ReactNode; resetKey?: string; reload?: () => void }

/**
 * Pages load as separate files. If one can't be fetched (offline, or an older tab after an
 * update), say so and offer a reload instead of leaving a blank page.
 */
export class LoadErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    const reload = this.props.reload ?? (() => window.location.reload())
    return (
      <div className={styles.page}>
        <Logo size={28} />
        <h1 className={styles.h}>Couldn't load this part of OpenDeck</h1>
        <p className={styles.p}>Check your connection, then reload. Your decks are safe on this computer.</p>
        <Button variant="primary" icon={RefreshCw} onClick={reload}>Reload</Button>
      </div>
    )
  }
}
