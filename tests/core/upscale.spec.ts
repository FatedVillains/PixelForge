import { describe, expect, it } from 'vitest'
import { resampleRGBA } from '../../src/core/upscale/resample'
import { checkOutputLimits, solveTarget } from '../../src/core/upscale/target'
import { estimateMemory, autoTileSize } from '../../src/core/upscale/memory'
import { resolvePreset } from '../../src/core/upscale/presets'

describe('solveTarget', () => {
  it('按倍率放大', () => {
    const p = solveTarget(1920, 1080, {
      mode: 'scale',
      scale: 4,
      keepAspectRatio: true,
      aspectMode: 'fit',
    })
    expect([p.outW, p.outH]).toEqual([7680, 4320])
    expect(p.suffix).toBe('4x')
  })

  it('按目标分辨率放大（4K 长边）', () => {
    const p = solveTarget(1920, 1080, {
      mode: 'resolution',
      resolution: 3840,
      keepAspectRatio: true,
      aspectMode: 'fit',
    })
    expect([p.outW, p.outH]).toEqual([3840, 2160])
    expect(p.suffix).toBe('4K')
  })

  it('自定义尺寸锁定宽高比时自动计算高度', () => {
    const p = solveTarget(1920, 1080, {
      mode: 'custom',
      width: 7680,
      height: 0,
      keepAspectRatio: true,
      aspectMode: 'fit',
    })
    expect([p.outW, p.outH]).toEqual([7680, 4320])
  })

  it('fit 模式不拉伸', () => {
    const p = solveTarget(1920, 1080, {
      mode: 'custom',
      width: 4000,
      height: 4000,
      keepAspectRatio: false,
      aspectMode: 'fit',
    })
    expect(p.outW).toBe(4000)
    expect(p.outH).toBe(2250)
  })

  it('crop 模式裁剪源区域并填满输出', () => {
    const p = solveTarget(1920, 1080, {
      mode: 'custom',
      width: 2000,
      height: 2000,
      keepAspectRatio: false,
      aspectMode: 'crop',
    })
    expect([p.outW, p.outH]).toEqual([2000, 2000])
    expect(p.srcH).toBe(1080)
    expect(p.srcW).toBe(1080) // 取居中正方形
    expect(p.srcX).toBe((1920 - 1080) / 2)
  })
})

describe('checkOutputLimits', () => {
  it('32768 以内正常', () => {
    expect(checkOutputLimits(15360, 8640).ok).toBe(true)
    expect(checkOutputLimits(15360, 8640).warn).toBe(false)
  })
  it('超过 32768 告警', () => {
    const r = checkOutputLimits(40000, 100)
    expect(r.ok).toBe(true)
    expect(r.warn).toBe(true)
  })
  it('超过 64000 拒绝', () => {
    expect(checkOutputLimits(65000, 100).ok).toBe(false)
  })
})

describe('resampleRGBA', () => {
  function solid(w: number, h: number, rgba: [number, number, number, number]) {
    const d = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < d.length; i += 4) d.set(rgba, i)
    return d
  }

  it('纯色图放大后仍为纯色（lanczos/bicubic/bilinear）', async () => {
    for (const algo of ['lanczos', 'bicubic', 'bilinear'] as const) {
      const out = await resampleRGBA(solid(8, 8, [10, 128, 250, 255]), 8, 8, 32, 32, algo)
      expect(out.length).toBe(32 * 32 * 4)
      for (let i = 0; i < out.length; i += 4) {
        expect(Math.abs(out[i]! - 10)).toBeLessThanOrEqual(2)
        expect(Math.abs(out[i + 1]! - 128)).toBeLessThanOrEqual(2)
        expect(Math.abs(out[i + 2]! - 250)).toBeLessThanOrEqual(2)
        expect(out[i + 3]).toBe(255)
      }
    }
  })

  it('nearest 2x 每像素变 2×2 块', async () => {
    const src = new Uint8ClampedArray(2 * 1 * 4)
    src.set([255, 0, 0, 255], 0)
    src.set([0, 0, 255, 255], 4)
    const out = await resampleRGBA(src, 2, 1, 4, 2, 'nearest')
    expect(out[0]).toBe(255) // 左上红
    expect(out[4]).toBe(255)
    expect(out[(1 * 4 + 2) * 4 + 2]).toBe(255) // 右上蓝
    expect(out[(1 * 4 + 3) * 4 + 2]).toBe(255)
  })

  it('bilinear 水平渐变中点插值', async () => {
    const src = new Uint8ClampedArray(2 * 1 * 4)
    src.set([0, 0, 0, 255], 0)
    src.set([100, 100, 100, 255], 4)
    const out = await resampleRGBA(src, 2, 1, 4, 1, 'bilinear')
    /* 中间两像素应介于 0-100 且单调 */
    expect(out[4]!).toBeGreaterThan(out[0]!)
    expect(out[8]!).toBeGreaterThan(out[4]!)
    expect(out[12]!).toBeGreaterThanOrEqual(out[8]!)
  })

  it('支持取消', async () => {
    const src = solid(64, 64, [1, 2, 3, 255])
    await expect(
      resampleRGBA(src, 64, 64, 4096, 4096, 'lanczos', undefined, () => true),
    ).rejects.toThrow('已取消')
  })
})

describe('estimateMemory', () => {
  it('小图直通', () => {
    expect(estimateMemory(1920, 1080, 3840, 2160).level).toBe('ok')
  })
  it('超大输出走分块', () => {
    const est = estimateMemory(1920, 1080, 15360, 8640)
    expect(est.level).toBe('tile')
  })
  it('autoTileSize 返回合理值', () => {
    expect(autoTileSize(7680, 4320)).toBe(2048)
    expect(autoTileSize(15360, 8640)).toBe(1024)
  })
})

describe('resolvePreset', () => {
  it('像素画用 nearest 且关闭全部后处理', () => {
    const p = resolvePreset('pixel', 100, 100)
    expect(p.algorithm).toBe('nearest')
    expect(p.denoise).toBe(0)
    expect(p.sharpen.amount).toBe(0)
    expect(p.edgeEnhance).toBe(0)
  })
  it('人像低锐化', () => {
    expect(resolvePreset('portrait', 100, 100).sharpen.amount).toBeLessThan(0.6)
  })
  it('auto 极端长图按文字处理', () => {
    expect(resolvePreset('auto', 4000, 500).algorithm).toBe('lanczos')
    expect(resolvePreset('auto', 4000, 500).edgeEnhance).toBe(3)
  })
})
