import { describe, it, expect } from 'vitest'
import {
  GUARD_MAX_BYTES,
  GUARD_MAX_PIXELS,
  checkBytesGuard,
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
