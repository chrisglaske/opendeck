import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { mediaStub } from '../test/setup'
import { useColorMode } from './useColorMode'

it('follows the system live while mode is system, and stops after an explicit choice', () => {
  mediaStub.matches = false
  const { result } = renderHook(() => useColorMode())
  expect(result.current.mode).toBe('system')
  expect(result.current.resolved).toBe('light')

  act(() => mediaStub.set(true))
  expect(result.current.resolved).toBe('dark')
  expect(document.documentElement.dataset.mode).toBe('dark')

  act(() => result.current.setMode('light'))
  expect(result.current.resolved).toBe('light')
  act(() => mediaStub.set(true))
  expect(result.current.resolved).toBe('light')
  expect(document.documentElement.dataset.mode).toBe('light')
})
