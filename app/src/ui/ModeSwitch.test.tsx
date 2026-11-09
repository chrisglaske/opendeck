import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MODE_STORAGE_KEY } from '../theme/colorMode'
import ModeSwitch from './ModeSwitch'

it('clicking Dark applies and remembers dark mode', async () => {
  render(<ModeSwitch />)
  expect(screen.getByRole('radiogroup', { name: 'Appearance' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
  expect(document.documentElement.dataset.mode).toBe('dark')
  expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark')
})

it('the compact switch shows only icons for Light and Dark and the word Auto, and still works', async () => {
  render(<ModeSwitch compact />)
  const light = screen.getByRole('radio', { name: 'Light' })
  expect(light).not.toHaveTextContent('Light')
  expect(screen.getByRole('radio', { name: 'Dark' })).not.toHaveTextContent('Dark')
  expect(screen.getByRole('radio', { name: 'Auto' })).toHaveTextContent('Auto')
  await userEvent.click(light)
  expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('light')
})
