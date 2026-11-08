import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Bold } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  Button,
  Checkbox,
  IconButton,
  NumberField,
  SegmentedControl,
  Tabs,
  Toggle,
  Tooltip,
} from './index'

describe('Button', () => {
  it('defaults to type=button and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toHaveAttribute('type', 'button')
    await userEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  it('is named by its label, reflects pressed, and shows its tooltip on focus', async () => {
    render(<IconButton icon={Bold} label="Bold" pressed />)
    const btn = screen.getByRole('button', { name: 'Bold' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    act(() => btn.focus())
    // The tooltip only repeats the name, so it is hidden from assistive tech (no double reading).
    const tip = screen.getByRole('tooltip', { hidden: true })
    expect(tip).toHaveTextContent('Bold')
    expect(tip).toHaveAttribute('aria-hidden', 'true')
    expect(btn).not.toHaveAttribute('aria-describedby')
  })
  it('has no aria-pressed when pressed is undefined', () => {
    render(<IconButton icon={Bold} label="Bold" />)
    expect(screen.getByRole('button', { name: 'Bold' })).not.toHaveAttribute('aria-pressed')
  })
})

describe('NumberField', () => {
  const setup = (props: { max?: number } = {}) => {
    const onChange = vi.fn()
    render(<NumberField label="Width" value={10} onChange={onChange} {...props} />)
    return { onChange, input: screen.getByLabelText('Width') }
  }
  it('ArrowUp steps by 1', async () => {
    const { onChange, input } = setup()
    await userEvent.type(input, '{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith(11)
  })
  it('Shift+ArrowUp steps by 10', async () => {
    const { onChange, input } = setup()
    await userEvent.type(input, '{Shift>}{ArrowUp}{/Shift}')
    expect(onChange).toHaveBeenLastCalledWith(20)
  })
  it('clamps to max', async () => {
    const { onChange, input } = setup({ max: 12 })
    await userEvent.type(input, '{Shift>}{ArrowUp}{/Shift}')
    expect(onChange).toHaveBeenLastCalledWith(12)
  })
  it('reverts non-numeric text on blur without calling onChange', async () => {
    const { onChange, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, 'abc')
    await userEvent.tab()
    expect(input).toHaveValue('10')
    expect(onChange).not.toHaveBeenCalled()
  })
  it('commits a typed number on Enter', async () => {
    const { onChange, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '42{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(42)
  })
})

describe('SegmentedControl', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma' },
  ]
  it('ArrowRight from the first option selects the second; only the selected radio is tabbable', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl label="Pick" options={options} value="a" onChange={onChange} />)
    expect(screen.getByRole('radiogroup', { name: 'Pick' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1])
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    act(() => radios[0].focus())
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

describe('Toggle and Checkbox', () => {
  it('Toggle flips aria-checked', async () => {
    function Harness() {
      const [on, setOn] = useState(false)
      return <Toggle label="Snap" checked={on} onChange={setOn} />
    }
    render(<Harness />)
    const sw = screen.getByRole('switch', { name: 'Snap' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })
  it('Checkbox is reachable by its label', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Lock" checked={false} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Lock'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('Tabs', () => {
  it('ArrowRight moves the selection', async () => {
    function Harness() {
      const [v, setV] = useState('style')
      return (
        <Tabs
          label="Panel"
          tabs={[
            { id: 'style', label: 'Style' },
            { id: 'arrange', label: 'Arrange' },
          ]}
          value={v}
          onChange={setV}
        />
      )
    }
    render(<Harness />)
    const [style, arrange] = screen.getAllByRole('tab')
    expect(style).toHaveAttribute('aria-selected', 'true')
    act(() => style.focus())
    await userEvent.keyboard('{ArrowRight}')
    expect(arrange).toHaveAttribute('aria-selected', 'true')
    expect(arrange).toHaveFocus()
  })
})

describe('Tooltip', () => {
  it('Esc hides it while open', async () => {
    render(
      <Tooltip content="Undo" shortcut="⌘Z">
        <button type="button">u</button>
      </Tooltip>,
    )
    act(() => screen.getByRole('button').focus())
    expect(screen.getByRole('tooltip')).toHaveTextContent('Undo')
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
  it('appears after 400ms of hover', () => {
    vi.useFakeTimers()
    try {
      render(
        <Tooltip content="Redo">
          <button type="button">r</button>
        </Tooltip>,
      )
      fireEvent.mouseEnter(screen.getByRole('button'))
      act(() => vi.advanceTimersByTime(399))
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      expect(screen.getByRole('tooltip')).toHaveTextContent('Redo')
    } finally {
      vi.useRealTimers()
    }
  })
})
