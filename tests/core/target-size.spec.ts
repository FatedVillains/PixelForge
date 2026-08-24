import { describe, it, expect, vi } from 'vitest'
import { solveTargetSize } from '../../src/core/processors/target-size'

/** 确定性模型：size(q, s) = q * 1000 * s² */
const linearProbe = vi.fn(
  (q: number, s: number) => Promise.resolve(Math.round(q * 1000 * s * s)),
)

describe('solveTargetSize', () => {
  it('returns max quality when generous target', async () => {
    const r = await solveTargetSize(512 * 1024, linearProbe)
    expect(r.fitsTarget).toBe(true)
    expect(r.quality).toBe(100)
    expect(r.scale).toBe(1)
  })

  it('finds exact boundary quality', async () => {
    const probe = (q: number, s: number) =>
      Promise.resolve(Math.round(q * 1000 * s * s))
    const r = await solveTargetSize(50_000, probe)
    expect(r).toMatchObject({ fitsTarget: true, quality: 50, scale: 1 })
    expect(r.encodes).toBeLessThanOrEqual(8)
  })

  it('falls back to smaller scale when unreachable', async () => {
    const probe = (q: number, s: number) =>
      Promise.resolve(Math.round(q * 1000 * s * s))
    const r = await solveTargetSize(500, probe)
    expect(r.fitsTarget).toBe(true)
    expect(r.scale).toBeLessThan(1)
    const finalSize = await probe(r.quality, r.scale)
    expect(finalSize).toBeLessThanOrEqual(500)
  })

  it('respects encode budget and reports best effort', async () => {
    const huge = () => Promise.resolve(Number.MAX_SAFE_INTEGER)
    const r = await solveTargetSize(100, huge, { maxEncodes: 5 })
    expect(r.fitsTarget).toBe(false)
    expect(r.quality).toBe(1)
  })

  it('caches duplicate probes', async () => {
    const spy = vi.fn((q: number, _s: number) => Promise.resolve(q * 100))
    await solveTargetSize(50_000, spy)
    const calls = spy.mock.calls.map((c) => `${c[0]}@${c[1]}`)
    expect(new Set(calls).size).toBe(calls.length)
  })
})
