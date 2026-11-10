import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { ThemeChips } from './ThemeChips'

function Harness() {
  const [v, setV] = useState('opendeck')
  return <ThemeChips value={v} onChange={setV} />
}

const radios = () => screen.getAllByRole('radio')

it('offers one chip per built-in theme, starting on OpenDeck', () => {
  render(<Harness />)
  expect(screen.getByRole('radiogroup', { name: 'Try a theme' })).toBeInTheDocument()
  expect(radios().map((r) => r.textContent)).toEqual(['OpenDeck', 'Boardroom', 'Editorial', 'Midnight', 'Sage', 'Swiss'])
  expect(screen.getByRole('radio', { name: 'OpenDeck' })).toHaveAttribute('aria-checked', 'true')
  expect(radios().filter((r) => r.tabIndex === 0)).toEqual([screen.getByRole('radio', { name: 'OpenDeck' })])
})

it('moves and selects with the arrow keys, wrapping at the ends', async () => {
  render(<Harness />)
  await userEvent.click(screen.getByRole('radio', { name: 'Swiss' }))
  expect(screen.getByRole('radio', { name: 'Swiss' })).toHaveAttribute('aria-checked', 'true')
  await userEvent.keyboard('{ArrowRight}')
  const first = screen.getByRole('radio', { name: 'OpenDeck' })
  expect(first).toHaveAttribute('aria-checked', 'true')
  expect(first).toHaveFocus()
  await userEvent.keyboard('{ArrowLeft}')
  expect(screen.getByRole('radio', { name: 'Swiss' })).toHaveAttribute('aria-checked', 'true')
  expect(radios().filter((r) => r.tabIndex === 0)).toEqual([screen.getByRole('radio', { name: 'Swiss' })])
})
