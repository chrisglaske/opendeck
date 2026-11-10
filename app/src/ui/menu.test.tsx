import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Menu } from './Menu'
import type { MenuItem } from './Menu'

function setup(extra: Partial<{ onA: () => void; onSub: () => void; onDisabled: () => void }> = {}) {
  const onA = extra.onA ?? vi.fn()
  const onSub = extra.onSub ?? vi.fn()
  const onDisabled = extra.onDisabled ?? vi.fn()
  const items: MenuItem[] = [
    { id: 'a', label: 'Alpha', onSelect: onA },
    { id: 'off', label: 'Greyed', disabled: true, onSelect: onDisabled },
    'separator',
    {
      id: 'move', label: 'Move to', onSelect: () => {},
      submenu: [
        { id: 'none', label: 'Nowhere', checked: true, onSelect: () => {} },
        'separator',
        { id: 'x', label: 'Place X', checked: false, onSelect: onSub },
      ],
    },
  ]
  render(<Menu label="Things" items={items} trigger={<button type="button">More</button>} />)
  return { onA, onSub, onDisabled }
}

describe('Menu: disabled, checked and submenus', () => {
  it('a disabled item is announced as disabled and does nothing', async () => {
    const { onDisabled } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    const item = screen.getByRole('menuitem', { name: 'Greyed' })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(item)
    expect(onDisabled).not.toHaveBeenCalled()
    expect(screen.getByRole('menu', { name: 'Things' })).toBeInTheDocument()
  })

  it('a parent item says it has a submenu; ArrowRight opens it and focuses its first item', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    const parent = screen.getByRole('menuitem', { name: 'Move to' })
    expect(parent).toHaveAttribute('aria-haspopup', 'menu')
    expect(parent).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard('{ArrowUp}')
    expect(parent).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(parent).toHaveAttribute('aria-expanded', 'true')
    const sub = screen.getByRole('menu', { name: 'Move to' })
    expect(sub).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Nowhere' })).toHaveFocus()
    expect(screen.getByRole('menuitemradio', { name: 'Nowhere' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'Place X' })).toHaveAttribute('aria-checked', 'false')
  })

  it('ArrowLeft closes the submenu and returns to its parent', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{ArrowLeft}')
    expect(screen.queryByRole('menu', { name: 'Move to' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Move to' })).toHaveFocus()
    expect(screen.getByRole('menu', { name: 'Things' })).toBeInTheDocument()
  })

  it('Esc in a submenu closes everything', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()
  })

  it('arrows move inside the submenu and Enter selects and closes all', async () => {
    const { onSub } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{ArrowDown}')
    expect(screen.getByRole('menuitemradio', { name: 'Place X' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onSub).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('hovering a parent opens its submenu; clicking a sub item selects it', async () => {
    const { onSub } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: 'Move to' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Place X' }))
    expect(onSub).toHaveBeenCalledOnce()
  })

  it('can be opened from outside (for right-click)', async () => {
    const onA = vi.fn()
    function Wrap() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Elsewhere</button>
          <Menu label="Things" open={open} onOpenChange={setOpen} items={[{ id: 'a', label: 'Alpha', onSelect: onA }]} trigger={<button type="button">More</button>} />
        </>
      )
    }
    render(<Wrap />)
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onA).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
