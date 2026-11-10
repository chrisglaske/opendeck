import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MoveDemo } from './MoveDemo'

describe('the move demo card', () => {
  it('is not a button (Enter and Space do nothing), and says what it is', () => {
    render(<MoveDemo />)
    expect(screen.queryByRole('button', { name: /^Demo card/ })).toBeNull()
    expect(screen.getByRole('group', { name: /^Demo card\./ })).toBeInTheDocument()
  })

  it('announces each keyboard move and resize', async () => {
    render(<MoveDemo />)
    screen.getByRole('group', { name: /^Demo card\./ }).focus()
    expect(screen.getByRole('status')).toHaveTextContent('')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('status')).toHaveTextContent(/^Moved\. Card is at \d+% from the left, \d+% from the top\.$/)
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
    expect(screen.getByRole('status')).toHaveTextContent(/^Resized\. Card is \d+% wide and \d+% tall\.$/)
  })
})
