import { describe, it, expect } from 'vitest'
import { extractRegion, mirrorIndex } from '../../src/core/upscale/tile'

/** 1×N 灰度图：像素值即其行号，便于断言映射结果 */
function ramp(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4
      d[p] = y * 10
      d[p + 1] = x * 10
      d[p + 2] = 7
      d[p + 3] = 255
    }
  }
  return d
}

const redOf = (d: Uint8ClampedArray, i: number) => d[i * 4]
const greenOf = (d: Uint8ClampedArray, i: number) => d[i * 4 + 1]

describe('mirrorIndex', () => {
  it('passes in-range indices through', () => {
    expect(mirrorIndex(0, 5)).toBe(0)
    expect(mirrorIndex(4, 5)).toBe(4)
  })
  it('reflects below zero', () => {
    expect(mirrorIndex(-1, 5)).toBe(1)
    expect(mirrorIndex(-2, 5)).toBe(2)
  })
  it('reflects above the last index', () => {
    expect(mirrorIndex(5, 5)).toBe(3)
    expect(mirrorIndex(6, 5)).toBe(2)
  })
  it('handles the degenerate single-pixel axis', () => {
    expect(mirrorIndex(7, 1)).toBe(0)
    expect(mirrorIndex(-7, 0)).toBe(0)
  })
})

describe('extractRegion', () => {
  it('copies an in-bounds region verbatim', () => {
    const src = ramp(4, 4)
    const out = extractRegion(src, 4, 4, 1, 1, 2, 2)
    /* 行 0 取 src 的 y=1,x=1..2；行 1 取 y=2,x=1..2（不是连续切片） */
    const px = (y: number, x: number) => (y * 4 + x) * 4
    const want = [
      ...src.slice(px(1, 1), px(1, 1) + 8),
      ...src.slice(px(2, 1), px(2, 1) + 8),
    ]
    expect([...out]).toEqual(want)
  })

  it('mirrors rather than clamps past the right edge', () => {
    const src = ramp(4, 1)
    /* x=4,5 越界：镜像应为 2,1（clamp 会得到 3,3） */
    const out = extractRegion(src, 4, 1, 0, 0, 6, 1)
    const greens = [0, 1, 2, 3, 2, 1].map((x) => greenOf(out, x))
    expect(greens).toEqual([0, 10, 20, 30, 20, 10])
  })

  it('mirrors above the bottom edge', () => {
    const src = ramp(1, 4)
    const out = extractRegion(src, 1, 4, 0, 0, 1, 6)
    const reds = [0, 1, 2, 3, 2, 1].map((y) => redOf(out, y))
    expect(reds).toEqual([0, 10, 20, 30, 20, 10])
  })

  it('mirrors in both axes at the far corner', () => {
    const src = ramp(2, 2)
    /* n=2 时镜像周期也是 2：x=2..3 折回 (0,1)，y=2..3 折回 (0,1) */
    const p = [0, 4, 8, 12]
    const row0 = [...src.slice(p[0], p[0] + 4), ...src.slice(p[1], p[1] + 4), ...src.slice(p[0], p[0] + 4), ...src.slice(p[1], p[1] + 4)]
    const row1 = [...src.slice(p[2], p[2] + 4), ...src.slice(p[3], p[3] + 4), ...src.slice(p[2], p[2] + 4), ...src.slice(p[3], p[3] + 4)]
    const out = extractRegion(src, 2, 2, 2, 2, 4, 4)
    expect([...out]).toEqual([...row0, ...row1, ...row0, ...row1])
  })

  it('returns an empty buffer for a zero-size region', () => {
    expect(extractRegion(ramp(4, 4), 4, 4, 0, 0, 0, 3).length).toBe(0)
  })

  it('keeps alpha from the mirrored source pixel', () => {
    const src = ramp(2, 1)
    src[3] = 0
    const out = extractRegion(src, 2, 1, 0, 0, 4, 1)
    expect(out[3]).toBe(0)
  })
})
