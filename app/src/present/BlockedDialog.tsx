import { Maximize } from 'lucide-react'
import { Button, Dialog } from '../ui'

/** Shown when the browser blocked the slides window. Both buttons open it from their own click. */
export function BlockedDialog({ onRetry, onFullscreen, onClose }: { onRetry(): void; onFullscreen(): void; onClose(): void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="The slides window didn't open"
      description="Your browser blocked it. Allow pop-ups for OpenDeck (look for the icon at the right of the address bar), then try again."
      actions={
        <>
          <Button variant="ghost" icon={Maximize} onClick={onFullscreen}>Present full screen instead</Button>
          <Button variant="primary" onClick={onRetry}>Try again</Button>
        </>
      }
    />
  )
}
