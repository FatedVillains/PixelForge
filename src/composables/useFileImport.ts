import { checkBytesGuard, checkPixelsGuard } from '../core/guard'
import { createSurface, decodeImage, releaseBitmap } from '../core/codec'
import { sniffFile } from '../core/sniff'
import { useImagesStore } from '../stores/images'

export interface ImportCallbacks {
  confirmOversize: (reason: string) => Promise<boolean>
  onError: (message: string) => void
}

async function makeThumbUrl(bitmap: ImageBitmap): Promise<string> {
  const max = 320
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * ratio))
  const h = Math.max(1, Math.round(bitmap.height * ratio))
  const surface = createSurface(w, h)
  const ctx = surface.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('无法生成缩略图')
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
  if ('toDataURL' in surface) {
    return (surface as HTMLCanvasElement).toDataURL('image/jpeg', 0.8)
  }
  const blob = await (surface as OffscreenCanvas).convertToBlob({
    type: 'image/jpeg',
    quality: 0.8,
  })
  return URL.createObjectURL(blob)
}

function extFor(format: string): string {
  return format === 'jpeg' ? 'jpg' : format
}

export function useFileImport() {
  const images = useImagesStore()

  async function importFiles(files: File[], cb: ImportCallbacks): Promise<number> {
    let imported = 0
    for (const file of files) {
      try {
        const format = await sniffFile(file)
        if (format === 'unknown') {
          cb.onError(`不支持的图片格式：${file.name}`)
          continue
        }
        const bytesGuard = checkBytesGuard(file.size)
        if (bytesGuard.oversized) {
          const ok = await cb.confirmOversize(`${file.name}：${bytesGuard.reason}`)
          if (!ok) continue
        }
        const decoded = await decodeImage(file)
        try {
          const pxGuard = checkPixelsGuard(decoded.width, decoded.height)
          if (pxGuard.oversized) {
            const ok = await cb.confirmOversize(`${file.name}：${pxGuard.reason}`)
            if (!ok) continue
          }
          images.addAsset({
            name: file.name || `粘贴图片.${extFor(format)}`,
            bytes: file.size,
            format,
            width: decoded.width,
            height: decoded.height,
            file,
            thumbUrl: await makeThumbUrl(decoded.bitmap),
          })
          imported += 1
        } finally {
          releaseBitmap(decoded.bitmap)
        }
      } catch (err) {
        cb.onError(err instanceof Error ? err.message : `导入失败：${file.name}`)
      }
    }
    return imported
  }

  return { importFiles }
}
