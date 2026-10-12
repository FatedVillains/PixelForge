import { Zip, ZipPassThrough } from 'fflate'

/** 打包内容总量上限：超过则拒绝，避免把渲染进程内存打爆 */
export const ZIP_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024

export interface ZipSource {
  name: string
  blob: Blob
}

/**
 * 流式打包：逐个读取 Blob 并立即喂给 ZipPassThrough，
 * 峰值内存 ≈ 已产出的分块 + 当前一个文件，而不是「全部文件 + 完整 zip」。
 * level 0（store）：图片本身已压缩，再 deflate 几乎无收益。
 */
export async function zipBlobs(
  sources: ZipSource[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (sources.length === 0) throw new Error('没有可打包的文件')

  const totalBytes = sources.reduce((sum, s) => sum + s.blob.size, 0)
  if (totalBytes > ZIP_MAX_TOTAL_BYTES) {
    throw new Error(
      `打包内容合计 ${(totalBytes / 1073741824).toFixed(2)} GB，` +
        `超过 ${(ZIP_MAX_TOTAL_BYTES / 1073741824).toFixed(0)} GB 上限，请分批导出`,
    )
  }

  return new Promise<Blob>((resolve, reject) => {
    const parts: BlobPart[] = []
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    const zip = new Zip((err, data, final) => {
      if (err) {
        finish(() => reject(err))
        return
      }
      parts.push(data as unknown as BlobPart)
      if (final) finish(() => resolve(new Blob(parts, { type: 'application/zip' })))
    })

    void (async () => {
      try {
        for (let i = 0; i < sources.length; i++) {
          const src = sources[i]!
          const entry = new ZipPassThrough(src.name)
          zip.add(entry)
          entry.push(new Uint8Array(await src.blob.arrayBuffer()), true)
          onProgress?.(i + 1, sources.length)
        }
        zip.end()
      } catch (e) {
        zip.terminate()
        finish(() => reject(e instanceof Error ? e : new Error(String(e))))
      }
    })()
  })
}
