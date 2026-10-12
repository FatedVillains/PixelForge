import type { OutputFormat } from './types'
import { stepDownPlan } from './processors/resize'

export type SurfaceCanvas = OffscreenCanvas | HTMLCanvasElement

export const supportsOffscreen: boolean = typeof OffscreenCanvas !== 'undefined'

export interface DecodedImage {
  bitmap: ImageBitmap
  width: number
  height: number
}

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    return { bitmap, width: bitmap.width, height: bitmap.height }
  } catch (err) {
    throw new Error(`图片无法解码（${blob.type || '未知格式'}），文件可能已损坏`, {
      cause: err,
    })
  }
}

export function createSurface(width: number, height: number): SurfaceCanvas {
  if (supportsOffscreen) return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function ctxOf(canvas: SurfaceCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: false }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

export function drawScaled(bitmap: ImageBitmap, toW: number, toH: number): SurfaceCanvas {
  const plan = stepDownPlan(bitmap.width, bitmap.height, toW, toH)
  let current = createSurface(plan[0]!.width, plan[0]!.height)
  ctxOf(current).drawImage(
    bitmap as CanvasImageSource,
    0, 0, bitmap.width, bitmap.height,
    0, 0, plan[0]!.width, plan[0]!.height,
  )
  for (let i = 1; i < plan.length; i++) {
    const next = createSurface(plan[i]!.width, plan[i]!.height)
    ctxOf(next).drawImage(
      current as CanvasImageSource,
      0, 0, current.width, current.height,
      0, 0, plan[i]!.width, plan[i]!.height,
    )
    current = next
  }
  return current
}

function qualityArg(quality?: number): number | undefined {
  return quality === undefined ? undefined : Math.min(1, Math.max(0, quality / 100))
}

/**
 * 画布编码遇到不支持的类型时会静默回退到 image/png，调用方拿到的 blob.type
 * 因此不一定等于请求值。若不校验，管线会把请求格式当作 result.format 写出去，
 * 最终下载到「扩展名说 png、内容却是别的格式」的文件。
 */
function assertEncodedAs(blob: Blob, mime: string): Blob {
  if (blob.type !== mime) {
    throw new Error(
      `当前环境不支持 ${mime.replace('image/', '').toUpperCase()} 编码` +
        `（实际输出 ${blob.type || '未知格式'}），请改用其他格式`,
    )
  }
  return blob
}

export async function encodeSurface(
  canvas: SurfaceCanvas,
  format: OutputFormat,
  quality?: number,
): Promise<Blob> {
  const mime = `image/${format}`
  const q = qualityArg(quality)
  if ('convertToBlob' in canvas) {
    return assertEncodedAs(await canvas.convertToBlob({ type: mime, quality: q }), mime)
  }
  return new Promise<Blob>((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob(
      (b) => {
        if (!b) {
          reject(new Error('图片编码失败'))
          return
        }
        try {
          resolve(assertEncodedAs(b, mime))
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      },
      mime,
      q,
    )
  })
}

export function releaseBitmap(bitmap: ImageBitmap): void {
  bitmap.close()
}
