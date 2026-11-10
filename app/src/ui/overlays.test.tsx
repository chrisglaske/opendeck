import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Copy, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Dialog, holdToasts, Menu, ToastHost, toast, type MenuItem } from './index'

describe('Menu', () => {
  const setup = () => {
    const onDuplicate = vi.fn()
    const onDelete = vi.fn()
    const items: MenuItem[] = [
      { id: 'dup', label: 'Duplicate', icon: Copy, shortcut: '⌘D', onSelect: onDuplicate },
      'separator',
      { id: 'del', label: 'Delete', icon: Trash2, danger: true, onSelect: onDelete },
    ]
    render(<Menu label="Slide actions" trigger={<Button>Actions</Button>} items={items} />)
    return { onDuplicate, onDelete, trigger: screen.getByRole('button', { name: 'Actions' }) }
  }

  it('ArrowDown on the trigger opens it and focuses the first item', async () => {
    const { trigger } = setup()
    act(() => trigger.focus())
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menu', { name: 'Slide actions' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('ArrowUp from the first item wraps to the last, skipping separators; Enter selects and closes', async () => {
    const { trigger, onDelete } = setup()
    act(() => trigger.focus())
    await userEvent.keyboard('{ArrowDown}{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onDelete).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Esc closes and returns focus to the trigger', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('a click outside closes it', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('Dialog', () => {
  function Harness({ onClose }: { onClose(): void }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <Dialog
          open={open}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          title="Delete deck?"
          description="This can't be undone."
          actions={<Button onClick={() => setOpen(false)}>Cancel</Button>}
        />
      </>
    )
  }

  it('is named by its title, cancel calls onClose, and focus returns to the opener', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Delete deck?' })
    expect(dialog).toHaveAccessibleDescription("This can't be undone.")

    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('a drag that starts inside the box and ends on the backdrop does not close it', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.pointerDown(screen.getByText('Delete deck?'))
    // The click lands on the common ancestor: the <dialog> itself.
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clicking the backdrop calls onClose', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    // A press and click whose target is the <dialog> itself is on the backdrop.
    fireEvent.pointerDown(screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('toast', () => {
  it('keeps at most three, auto-dismisses after 5s, and runs its action', () => {
    vi.useFakeTimers()
    try {
      const onAction = vi.fn()
      render(<ToastHost />)
      const region = screen.getByRole('status')
      expect(region).toHaveAttribute('aria-live', 'polite')
      act(() => {
        toast('One')
        toast('Two')
        toast('Three')
        toast('Deck deleted', { actionLabel: 'Undo', onAction })
      })
      expect(within(region).queryByText('One')).not.toBeInTheDocument()
      expect(within(region).getAllByText(/Two|Three|Deck deleted/)).toHaveLength(3)

      fireEvent.click(within(region).getByRole('button', { name: 'Undo' }))
      expect(onAction).toHaveBeenCalledOnce()

      act(() => vi.advanceTimersByTime(5000))
      expect(region).toBeEmptyDOMElement()
    } finally {
      vi.useRealTimers()
    }
  })

  it('toasts wait while a show runs', () => {
    render(<ToastHost />)
    act(() => holdToasts(true))
    act(() => toast('Saved elsewhere'))
    expect(screen.queryByText('Saved elsewhere')).not.toBeInTheDocument()
    act(() => holdToasts(false))
    expect(screen.getByText('Saved elsewhere')).toBeInTheDocument()
  })

  it('a toast with no time limit stays until it is acted on', () => {
    vi.useFakeTimers()
    try {
      render(<ToastHost />)
      act(() => toast('Reload to keep saving.', { actionLabel: 'Reload', durationMs: Infinity }))
      act(() => vi.advanceTimersByTime(60 * 60 * 1000))
      expect(screen.getByText('Reload to keep saving.')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('pauses while its action has keyboard focus', () => {
    vi.useFakeTimers()
    try {
      render(<ToastHost />)
      act(() => toast('Deck deleted', { actionLabel: 'Undo' }))
      const undo = screen.getByRole('button', { name: 'Undo' })
      act(() => undo.focus())
      act(() => vi.advanceTimersByTime(10_000))
      expect(screen.getByText('Deck deleted')).toBeInTheDocument()
      act(() => undo.blur())
      act(() => vi.advanceTimersByTime(5000))
      expect(screen.queryByText('Deck deleted')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns focus to where it was when a focused toast is dismissed', async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <ToastHost />
      </>,
    )
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    act(() => elsewhere.focus())
    act(() => toast('Deck deleted', { actionLabel: 'Undo' }))
    const undo = screen.getByRole('button', { name: 'Undo' })
    act(() => undo.focus())
    fireEvent.click(undo)
    expect(screen.queryByText('Deck deleted')).not.toBeInTheDocument()
    expect(elsewhere).toHaveFocus()
  })

  it('pauses its timer while hovered', () => {
    vi.useFakeTimers()
    try {
      render(<ToastHost />)
      act(() => toast('Saved'))
      const item = screen.getByText('Saved')
      act(() => vi.advanceTimersByTime(3000))
      fireEvent.mouseEnter(item)
      act(() => vi.advanceTimersByTime(10_000))
      expect(screen.getByText('Saved')).toBeInTheDocument()
      fireEvent.mouseLeave(item)
      act(() => vi.advanceTimersByTime(2000))
      expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
