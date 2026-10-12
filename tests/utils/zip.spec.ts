import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { zipBlobs } from '../../src/utils/zip'

const blob = (...bytes: number[]) => new Blob([new Uint8Array(bytes)])

describe('zipBlobs', () => {
  it('packs multiple named entries', async () => {
    const out = await zipBlobs([
      { name: 'a.bin', blob: blob(1, 2, 3) },
      { name: 'b.bin', blob: blob(9, 9) },
    ])
    expect(out.type).toBe('application/zip')
    const files = unzipSync(new Uint8Array(await out.arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual(['a.bin', 'b.bin'])
    expect([...files['a.bin']!]).toEqual([1, 2, 3])
    expect([...files['b.bin']!]).toEqual([9, 9])
  })

  it('reports progress once per entry', async () => {
    const seen: Array<[number, number]> = []
    await zipBlobs(
      [
        { name: 'a', blob: blob(1) },
        { name: 'b', blob: blob(2) },
        { name: 'c', blob: blob(3) },
      ],
      (done, total) => seen.push([done, total]),
    )
    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it('rejects an empty entry list', async () => {
    await expect(zipBlobs([])).rejects.toThrow('没有可打包的文件')
  })

  it('rejects oversized payloads before allocating', async () => {
    const huge = { size: 3 * 1024 * 1024 * 1024 } as Blob
    await expect(zipBlobs([{ name: 'x', blob: huge }])).rejects.toThrow('GB')
  })

  it('rejects when a blob cannot be read', async () => {
    const bad = {
      size: 1,
      arrayBuffer: () => Promise.reject(new Error('read failed')),
    } as unknown as Blob
    await expect(zipBlobs([{ name: 'x', blob: bad }])).rejects.toThrow('read failed')
  })
})
