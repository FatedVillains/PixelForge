import { decodeImage, drawScaled, encodeSurface, releaseBitmap } from './codec'
import { checkOutputGuard } from './guard'
import { computeTargetDimensions } from './processors/resize'
import { solveTargetSize } from './processors/target-size'
import type { ProcessOptions, ProcessResult } from './types'

export type ProgressReporter = (stage: string) => void

/** 目标大小搜索的时间预算（毫秒）：超时即返回当前最佳结果，避免长时间无反馈 */
const TARGET_SEARCH_BUDGET_MS = 15_000

function clampQuality(q: number): number {
  return Math.min(100, Math.max(1, Math.round(q)))
}

export async function runPipeline(
  blob: Blob,
  options: ProcessOptions,
  onProgress?: ProgressReporter,
): Promise<ProcessResult> {
  onProgress?.('正在解码')
  const decoded = await decodeImage(blob)
  const { bitmap } = decoded
  try {
    const target = options.resize
      ? computeTargetDimensions({ width: bitmap.width, height: bitmap.height }, options.resize)
      : { width: bitmap.width, height: bitmap.height }

    /* 输出尺寸守卫：必须在任何昂贵编码之前失败 */
    const guard = checkOutputGuard(target.width, target.height)
    if (guard.oversized) throw new Error(guard.reason)

    let iterations = 1
    let quality: number | undefined =
      options.mode === 'quality' ? clampQuality(options.quality ?? 80) : undefined
    let scale = 1
    let fitsTarget = true
    let budgetExhausted = false

    if (options.mode === 'targetSize') {
      if (!options.targetSizeBytes || options.targetSizeBytes <= 0)
        throw new Error('目标大小无效')
      if (options.outputFormat === 'png')
        throw new Error('PNG 为无损格式，不支持按目标大小压缩')
      onProgress?.('正在搜索最佳质量')
      const solved = await solveTargetSize(
        options.targetSizeBytes,
        async (q, s) => {
          const w = Math.max(1, Math.round(target.width * s))
          const h = Math.max(1, Math.round(target.height * s))
          const out = await encodeSurface(drawScaled(bitmap, w, h), options.outputFormat, q)
          return out.size
        },
        {
          maxDurationMs: TARGET_SEARCH_BUDGET_MS,
          onProbe: (encodes, max) => onProgress?.(`正在搜索最佳质量（${encodes}/${max}）`),
        },
      )
      quality = solved.quality
      scale = solved.scale
      fitsTarget = solved.fitsTarget
      budgetExhausted = solved.budgetExhausted
      iterations = solved.encodes + 1
    }

    onProgress?.('正在编码输出')
    const w = Math.max(1, Math.round(target.width * scale))
    const h = Math.max(1, Math.round(target.height * scale))
    const outBlob = await encodeSurface(drawScaled(bitmap, w, h), options.outputFormat, quality)

    return {
      blob: outBlob,
      width: w,
      height: h,
      bytes: outBlob.size,
      format: options.outputFormat,
      iterations,
      fitsTarget,
      budgetExhausted,
    }
  } finally {
    releaseBitmap(bitmap)
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const w = window as Window & { __pfRunPipeline?: typeof runPipeline }
  w.__pfRunPipeline = runPipeline
}
