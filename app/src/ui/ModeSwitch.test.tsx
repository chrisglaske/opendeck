import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MODE_STORAGE_KEY } from '../theme/colorMode'
import ModeSwitch from './ModeSwitch'

it('clicking Dark applies and remembers dark mode', async () => {
  render(<ModeSwitch />)
  expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Dark' }))
  expect(document.documentElement.dataset.mode).toBe('dark')
  expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark')
})
