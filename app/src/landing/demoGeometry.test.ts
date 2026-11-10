import { expect, it } from 'vitest'
import { DEMO_MIN, dragCard, keyCard, resizeCard } from './demoGeometry'
import { DEMO_CARD_START as S } from './slides'

const cx = S.x + S.w / 2

it('snaps the card centre to the slide centre when it comes close', () => {
  const r = dragCard(S, 960 + 20 - cx, -100)
  expect(r.rect.x + r.rect.w / 2).toBe(960)
  expect(r.snapX).toBe(true)
  expect(r.snapY).toBe(false)
})

it('leaves the card alone when it is not close', () => {
  const r = dragCard(S, 960 + 40 - cx, 0)
  expect(r.rect.x).toBe(S.x + 960 + 40 - cx)
  expect(r.snapX).toBe(false)
})

it('snaps vertically too', () => {
  const r = dragCard(S, 0, 540 - (S.y + S.h / 2) + 10)
  expect(r.rect.y + r.rect.h / 2).toBe(540)
  expect(r.snapY).toBe(true)
})

it('keeps the card on the slide', () => {
  expect(dragCard(S, 5000, 0).rect.x + S.w).toBe(1920)
  expect(dragCard(S, -5000, -5000).rect).toMatchObject({ x: 0, y: 0 })
})

it('resizes from the corner, no smaller than the minimum and no bigger than the slide', () => {
  expect(resizeCard(S, -2000, -2000)).toEqual({ ...S, ...DEMO_MIN })
  const big = resizeCard(S, 5000, 5000)
  expect(big.x + big.w).toBe(1920)
  expect(big.y + big.h).toBe(1080)
})

it('moves with arrows and resizes with Shift and arrows', () => {
  expect(keyCard(S, 'ArrowLeft', false)!.x).toBe(S.x - 20)
  expect(keyCard(S, 'ArrowDown', true)!.h).toBe(S.h + 20)
  expect(keyCard(S, 'ArrowRight', true)!.w).toBe(S.w + 20)
  expect(keyCard(S, 'a', false)).toBeNull()
})
