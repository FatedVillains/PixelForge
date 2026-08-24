import { describe, it, expect } from 'vitest'
import {
  computeTargetDimensions,
  stepDownPlan,
} from '../../src/core/processors/resize'

const orig = { width: 4032, height: 3024 }

describe('computeTargetDimensions', () => {
  it('returns original when no target', () => {
    expect(computeTargetDimensions(orig, undefined)).toEqual(orig)
  })
  it('locks aspect by width', () => {
    expect(
      computeTargetDimensions(orig, { width: 1920, height: 0, keepAspectRatio: true }),
    ).toEqual({ width: 1920, height: 1440 })
  })
  it('locks aspect by width even if both given', () => {
    expect(
      computeTargetDimensions(orig, { width: 1280, height: 999, keepAspectRatio: true }),
    ).toEqual({ width: 1280, height: 960 })
  })
  it('derives width from height when width missing', () => {
    expect(
      computeTargetDimensions(orig, { width: 0, height: 1512, keepAspectRatio: true }),
    ).toEqual({ width: 2016, height: 1512 })
  })
  it('free stretch when unlocked', () => {
    expect(
      computeTargetDimensions(orig, { width: 295, height: 413, keepAspectRatio: false }),
    ).toEqual({ width: 295, height: 413 })
  })
  it('exact id photo pixels', () => {
    expect(
      computeTargetDimensions({ width: 6000, height: 4000 }, {
        width: 295,
        height: 413,
        keepAspectRatio: false,
      }),
    ).toEqual({ width: 295, height: 413 })
  })
  it('clamps to min 1px', () => {
    expect(
      computeTargetDimensions(orig, { width: 0, height: 1, keepAspectRatio: true }).height,
    ).toBeGreaterThanOrEqual(1)
  })
})

describe('stepDownPlan', () => {
  it('single step for mild shrink', () => {
    expect(stepDownPlan(2000, 1500, 1920, 1440)).toEqual([
      { width: 1920, height: 1440 },
    ])
  })
  it('multi steps end at target', () => {
    const plan = stepDownPlan(8000, 6000, 800, 600)
    expect(plan[plan.length - 1]).toEqual({ width: 800, height: 600 })
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]!.width).toBeLessThan(plan[i - 1]!.width!)
    }
  })
  it('single step for upscale', () => {
    expect(stepDownPlan(640, 480, 1280, 960)).toEqual([
      { width: 1280, height: 960 },
    ])
  })
})
