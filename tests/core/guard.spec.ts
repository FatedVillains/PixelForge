import { describe, it, expect } from 'vitest'
import {
  GUARD_MAX_BYTES,
  GUARD_MAX_OUTPUT_PIXELS,
  GUARD_MAX_OUTPUT_SIDE,
  GUARD_MAX_PIXELS,
  checkBytesGuard,
  checkOutputGuard,
  checkPixelsGuard,
} from '../../src/core/guard'

describe('checkBytesGuard', () => {
  it('passes under limit', () => {
    expect(checkBytesGuard(GUARD_MAX_BYTES).oversized).toBe(false)
  })
  it('flags over limit with reason', () => {
    const r = checkBytesGuard(GUARD_MAX_BYTES + 1)
    expect(r.oversized).toBe(true)
    expect(r.reason).toBeTruthy()
  })
})

describe('checkPixelsGuard', () => {
  it('passes under limit', () => {
    const r = checkPixelsGuard(8000, 5000)
    expect(r.oversized).toBe(false)
  })
  it('flags over limit with reason', () => {
    const r = checkPixelsGuard(12000, 9000)
    expect(r.oversized).toBe(true)
    expect(r.reason).toContain('12000×9000')
  })
  it('exposes threshold constant', () => {
    expect(GUARD_MAX_PIXELS).toBe(40_000_000)
  })
})

describe('checkOutputGuard', () => {
  it('exposes output limit constants', () => {
    expect(GUARD_MAX_OUTPUT_PIXELS).toBe(64_000_000)
    expect(GUARD_MAX_OUTPUT_SIDE).toBe(20_000)
  })
  it('passes for normal output', () => {
    expect(checkOutputGuard(1920, 1080).oversized).toBe(false)
  })
  it('passes exactly at the pixel limit', () => {
    expect(checkOutputGuard(8000, 8000).oversized).toBe(false)
  })
  it('flags over the pixel limit and mentions the size', () => {
    const r = checkOutputGuard(20_000, 20_000)
    expect(r.oversized).toBe(true)
    expect(r.reason).toContain('20000×20000')
  })
  it('flags over the single-side limit first', () => {
    const r = checkOutputGuard(GUARD_MAX_OUTPUT_SIDE + 1, 10)
    expect(r.oversized).toBe(true)
    expect(r.reason).toContain('单边上限')
  })
})
