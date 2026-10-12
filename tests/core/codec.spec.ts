// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { encodeSurface } from '../../src/core/codec'

function fakeCanvas(mime: string, size = 8) {
  return {
    width: size,
    height: size,
    convertToBlob: async () => new Blob([new Uint8Array(size)], { type: mime }),
  } as unknown as OffscreenCanvas
}

describe('encodeSurface', () => {
  it('returns a blob matching the requested format', async () => {
    const png = await encodeSurface(fakeCanvas('image/png'), 'png')
    expect(png.type).toBe('image/png')
  })

  it('maps jpeg to image/jpeg', async () => {
    const jpeg = await encodeSurface(fakeCanvas('image/jpeg'), 'jpeg')
    expect(jpeg.type).toBe('image/jpeg')
  })

  it('maps webp to image/webp', async () => {
    const webp = await encodeSurface(fakeCanvas('image/webp'), 'webp')
    expect(webp.type).toBe('image/webp')
  })

  it('throws when the encoder silently falls back to another format', async () => {
    // 支持 webp 编码的环境不存在时，canvas 会静默回退成 png；
    // 此时绝不能把它当成 webp 结果写出去。
    await expect(encodeSurface(fakeCanvas('image/png'), 'webp')).rejects.toThrow(/webp/i)
  })

  it('throws when png request silently becomes jpeg', async () => {
    await expect(encodeSurface(fakeCanvas('image/jpeg'), 'png')).rejects.toThrow(/png/i)
  })
})