import { describe, it, expect } from 'vitest'
import {
  buildOutputName,
  sanitizeBaseName,
  splitFileName,
  uniqueName,
} from '../../src/utils/naming'

describe('sanitizeBaseName', () => {
  it('replaces windows-illegal characters', () => {
    expect(sanitizeBaseName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })
  it('strips trailing dots and spaces', () => {
    expect(sanitizeBaseName('photo...')).toBe('photo')
    expect(sanitizeBaseName('photo  ')).toBe('photo')
  })
  it('falls back for empty input', () => {
    expect(sanitizeBaseName('   ')).toBe('image')
    expect(sanitizeBaseName('')).toBe('image')
  })
  it('escapes windows reserved names', () => {
    expect(sanitizeBaseName('CON')).toBe('_CON')
    expect(sanitizeBaseName('lpt1')).toBe('_lpt1')
    expect(sanitizeBaseName('console')).toBe('console')
  })
  it('caps length', () => {
    expect(sanitizeBaseName('x'.repeat(500))).toHaveLength(120)
  })
})

describe('splitFileName', () => {
  it('splits base and ext', () => {
    expect(splitFileName('photo.JPG')).toEqual({ base: 'photo', ext: 'jpg' })
  })
  it('handles multiple dots', () => {
    expect(splitFileName('my.photo.png')).toEqual({ base: 'my.photo', ext: 'png' })
  })
  it('handles no ext', () => {
    expect(splitFileName('photo')).toEqual({ base: 'photo', ext: '' })
  })
})

describe('buildOutputName', () => {
  it('appends _compressed', () => {
    expect(
      buildOutputName('test.jpg', { ext: 'jpeg', suffixKind: 'compressed' }),
    ).toBe('test_compressed.jpeg')
  })
  it('appends dimensions suffix', () => {
    expect(
      buildOutputName('test.jpg', {
        ext: 'jpg',
        suffixKind: 'dimensions',
        width: 1920,
        height: 1080,
      }),
    ).toBe('test_1920x1080.jpg')
  })
  it('no suffix keeps base', () => {
    expect(buildOutputName('test.jpg', { ext: 'webp', suffixKind: 'none' })).toBe(
      'test.webp',
    )
  })
  it('ignores dimensions when kind is compressed', () => {
    expect(
      buildOutputName('a.png', {
        ext: 'png',
        suffixKind: 'compressed',
        width: 10,
        height: 10,
      }),
    ).toBe('a_compressed.png')
  })
  it('sanitizes the base name from pasted files', () => {
    expect(buildOutputName('we:ird|name.png', { ext: 'png', suffixKind: 'none' })).toBe(
      'we_ird_name.png',
    )
  })
})

describe('uniqueName', () => {
  it('returns name when free', () => {
    expect(uniqueName('a.jpg', new Set())).toBe('a.jpg')
  })
  it('appends sequence on collision', () => {
    const taken = new Set(['a.jpg', 'a(1).jpg'])
    expect(uniqueName('a.jpg', taken)).toBe('a(2).jpg')
  })
})
