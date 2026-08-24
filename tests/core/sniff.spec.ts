import { describe, it, expect } from 'vitest'
import { sniffFormat } from '../../src/core/sniff'

const jpegHead = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]
const pngHead = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const webpHead = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
const bmpHead = [0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const riffOnly = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]

describe('sniffFormat', () => {
  it('detects jpeg', () => {
    expect(sniffFormat(new Uint8Array(jpegHead))).toBe('jpeg')
  })
  it('detects png', () => {
    expect(sniffFormat(new Uint8Array(pngHead))).toBe('png')
  })
  it('detects webp', () => {
    expect(sniffFormat(new Uint8Array(webpHead))).toBe('webp')
  })
  it('detects bmp', () => {
    expect(sniffFormat(new Uint8Array(bmpHead))).toBe('bmp')
  })
  it('rejects riff without WEBP tag', () => {
    expect(sniffFormat(new Uint8Array(riffOnly))).toBe('unknown')
  })
  it('rejects short buffers', () => {
    expect(sniffFormat(new Uint8Array([0xff, 0xd8]))).toBe('unknown')
  })
})
