import { describe, it, expect } from 'vitest'
import { buildOutputName, splitFileName, uniqueName } from '../../src/utils/naming'

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
