import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BlockedDialog } from './BlockedDialog'

describe('BlockedDialog', () => {
  it('says what happened and offers both ways on', () => {
    const onRetry = vi.fn()
    const onFullscreen = vi.fn()
    render(<BlockedDialog onRetry={onRetry} onFullscreen={onFullscreen} onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: "The slides window didn't open" })).toBeInTheDocument()
    expect(screen.getByText(/Your browser blocked it\. Allow pop-ups for OpenDeck/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Present full screen instead' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onFullscreen).toHaveBeenCalledTimes(1)
  })
})
