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

it('the compact switch shows three equal icons (Light, Dark, Auto) that fill the width, and still works', async () => {
  render(<ModeSwitch compact />)
  const group = screen.getByRole('radiogroup', { name: 'Appearance' })
  expect(group).toHaveAttribute('data-fill', 'true')
  for (const name of ['Light', 'Dark', 'Auto']) {
    const radio = screen.getByRole('radio', { name })
    expect(radio).not.toHaveTextContent(name)
    expect(radio).toHaveAttribute('title', name)
    expect(radio.querySelector('svg')).not.toBeNull()
  }
  await userEvent.click(screen.getByRole('radio', { name: 'Light' }))
  expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('light')
})
