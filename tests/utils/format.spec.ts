import { describe, it, expect } from 'vitest'
import { compressionRatio, formatBytes } from '../../src/utils/format'

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })
  it('formats KB', () => {
    expect(formatBytes(2048)).toBe('2.00 KB')
  })
  it('formats small KB with two decimals', () => {
    expect(formatBytes(1536)).toBe('1.50 KB')
  })
  it('formats MB', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB')
  })
  it('handles invalid input', () => {
    expect(formatBytes(-1)).toBe('-')
    expect(formatBytes(NaN)).toBe('-')
  })
})

describe('compressionRatio', () => {
  it('computes percentage saved', () => {
    expect(compressionRatio(4820000, 486 * 1024)).toBeGreaterThan(80)
  })
  it('returns 0 when nothing saved', () => {
    expect(compressionRatio(100, 100)).toBe(0)
  })
  it('clamps negative to 0', () => {
    expect(compressionRatio(100, 200)).toBe(0)
  })
})
