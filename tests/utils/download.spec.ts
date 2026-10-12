// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  extForFormat,
  resultFileName,
  shouldUseZip,
  shouldUseZipUp,
  downloadResultsZip,
  downloadUpResults,
} from '../../src/utils/download'

const dims = { width: 100, height: 80 }

function makeResult(format: 'jpeg' | 'png' | 'webp', bytes = 3) {
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: `image/${format}` }),
    width: dims.width,
    height: dims.height,
    bytes,
    format,
    iterations: 1,
    fitsTarget: true,
  }
}

describe('extForFormat', () => {
  it('maps jpeg to the conventional jpg extension', () => {
    expect(extForFormat('jpeg')).toBe('jpg')
  })
  it('passes png and webp through unchanged', () => {
    expect(extForFormat('png')).toBe('png')
    expect(extForFormat('webp')).toBe('webp')
  })
})

describe('resultFileName', () => {
  it('names png output with .png', () => {
    expect(resultFileName('a.jpg', makeResult('png'), 'compressed')).toBe('a_compressed.png')
  })
  it('names jpeg output with .jpg', () => {
    expect(resultFileName('a.jpg', makeResult('jpeg'), 'compressed')).toBe('a_compressed.jpg')
  })
  it('names webp output with .webp', () => {
    expect(resultFileName('a.jpg', makeResult('webp'), 'none')).toBe('a.webp')
  })
})

describe('single vs zip routing', () => {
  it('routes a single finished result to a direct file download', () => {
    expect(shouldUseZip([{ assetName: 'a.jpg', result: makeResult('png') }])).toBe(false)
  })
  it('routes multiple finished results to a zip', () => {
    expect(
      shouldUseZip([
        { assetName: 'a.jpg', result: makeResult('png') },
        { assetName: 'b.jpg', result: makeResult('png') },
      ]),
    ).toBe(true)
  })
  it('treats an empty list as not-zip', () => {
    expect(shouldUseZip([])).toBe(false)
  })
  it('applies the same rule to upscale results', () => {
    expect(shouldUseZipUp([])).toBe(false)
    expect(shouldUseZipUp([{ assetName: 'a', result: makeResult('png') }])).toBe(false)
    expect(
      shouldUseZipUp([
        { assetName: 'a', result: makeResult('png') },
        { assetName: 'b', result: makeResult('png') },
      ]),
    ).toBe(true)
  })
})

// 这些辅助函数由实现导出，供两页共享同一套判定规则

describe('exports', () => {
  it('exposes the zip builders used by both views', () => {
    expect(typeof downloadResultsZip).toBe('function')
    expect(typeof downloadUpResults).toBe('function')
  })
})