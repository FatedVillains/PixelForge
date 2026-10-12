import { createSurface, decodeImage, encodeSurface, releaseBitmap } from '../codec'
import { denoise, edgeEnhance, unsharpMask } from './filters'
import { autoTileSize, estimateMemory } from './memory'
import { resampleRGBA } from './resample'
import { extractRegion } from './tile'
import { checkOutputLimits, solveTarget } from './target'
import type { UpscaleOptions, UpscaleProgress, UpscaleResult } from './types'
import { UpscaleCancelled } from './types'

export type UpscaleProgressFn = (p: UpscaleProgress) => void

export async function runUpscalePipeline(
  blob: Blob,
  options: UpscaleOptions,
  onProgress?: UpscaleProgressFn,
  cancelled?: () => boolean,
): Promise<UpscaleResult> {
  const started = Date.now()
  const report = (percent: number, stage: string, detail?: string) =>
    onProgress?.({ percent: Math.min(100, Math.max(0, percent)), stage, detail })

  report(1, '正在解码')
  const decoded = await decodeImage(blob)
  const { bitmap } = decoded
  try {
    const srcW = bitmap.width
    const srcH = bitmap.height
    const plan = solveTarget(srcW, srcH, options.target)

    const limits = checkOutputLimits(plan.outW, plan.outH)
    if (!limits.ok) throw new Error(limits.reason)

    const est = estimateMemory(plan.srcW, plan.srcH, plan.outW, plan.outH)
    if (est.level === 'block') throw new Error(`内存预估超限：${est.reason ?? ''}（预计 ${(est.bytes / 1073741824).toFixed(1)} GB）`)

    /* 源图 → RGBA（应用 crop 区域） */
    report(3, '正在读取像素')
    const srcSurface = createSurface(plan.srcW, plan.srcH)
    const srcCtx = srcSurface.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null
    if (!srcCtx) throw new Error('无法创建画布上下文')
    srcCtx.drawImage(
      bitmap as CanvasImageSource,
      plan.srcX,
      plan.srcY,
      plan.srcW,
      plan.srcH,
      0,
      0,
      plan.srcW,
      plan.srcH,
    )
    const srcImage = srcCtx.getImageData(0, 0, plan.srcW, plan.srcH)
    const srcData = srcImage.data
    /* 是否分块只由内存预估决定：不能被用户的 Tile Size 设置绕过，
       否则正好会退回预估判定为「会 OOM」的那条直通路径 */
    const useTiles = est.level === 'tile'

    /* 输出画布（fill 模式时内容小于画布，其余模式等大） */
    const canvas = createSurface(plan.outW, plan.outH)
    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null
    if (!ctx) throw new Error(`无法创建 ${plan.outW}×${plan.outH} 画布，已超出当前环境限制`)
    if (options.outputFormat === 'jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, plan.outW, plan.outH)
    }

    if (cancelled?.()) throw new UpscaleCancelled()

    if (!useTiles) {
      /* 直通路径：整图 重采样 → 降噪 → 边缘增强 → 锐化 */
      const contentW = plan.dstW
      const contentH = plan.dstH
      const resampled = await resampleRGBA(
        srcData,
        plan.srcW,
        plan.srcH,
        contentW,
        contentH,
        options.algorithm,
        (f) => report(5 + f * 55, '高质量重采样'),
        cancelled,
      )
      if (options.denoise > 0) {
        await denoise(resampled, contentW, contentH, options.denoise, (f) =>
          report(60 + f * 10, '降噪'),
        )
      }
      if (options.edgeEnhance > 0) {
        await edgeEnhance(resampled, contentW, contentH, options.edgeEnhance, (f) =>
          report(70 + f * 12, '边缘增强'),
        )
      }
      if (options.sharpen.amount > 0) {
        await unsharpMask(resampled, contentW, contentH, options.sharpen, (f) =>
          report(82 + f * 10, '锐化'),
        )
      }
      report(92, '正在合成输出')
      const outImage = new ImageData(resampled, contentW, contentH)
      ctx.putImageData(outImage, plan.dstX, plan.dstY)
    } else {
      /* 分块路径：输出内容区域切 tile，带 padding 采样与滤镜，裁核心拼接 */
      const tileSize = options.tileSize > 0 ? options.tileSize : autoTileSize(plan.dstW, plan.dstH)
      const pad = Math.max(0, options.tilePadding)
      const contentW = plan.dstW
      const contentH = plan.dstH
      const cols = Math.ceil(contentW / tileSize)
      const rows = Math.ceil(contentH / tileSize)
      const total = cols * rows
      const sxScale = plan.srcW / contentW
      const syScale = plan.srcH / contentH
      const finalBuf = new Uint8ClampedArray(plan.outW * plan.outH * 4)

      /* jpeg 白底 */
      if (options.outputFormat === 'jpeg') {
        for (let i = 0; i < finalBuf.length; i += 4) {
          finalBuf[i] = 255
          finalBuf[i + 1] = 255
          finalBuf[i + 2] = 255
          finalBuf[i + 3] = 255
        }
      }

      let done = 0
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          if (cancelled?.()) throw new UpscaleCancelled()
          const ox0 = tx * tileSize
          const oy0 = ty * tileSize
          const ox1 = Math.min(contentW, ox0 + tileSize)
          const oy1 = Math.min(contentH, oy0 + tileSize)
          /* 带 padding 的输出区域（夹取到内容边界） */
          const px0 = Math.max(0, ox0 - pad)
          const py0 = Math.max(0, oy0 - pad)
          const px1 = Math.min(contentW, ox1 + pad)
          const py1 = Math.min(contentH, oy1 + pad)
          const pw = px1 - px0
          const ph = py1 - py0

          /* 映射回源图坐标并取子区域 */
          const srx = Math.floor(px0 * sxScale)
          const sry = Math.floor(py0 * syScale)
          const srw = Math.ceil(px1 * sxScale) - srx
          const srh = Math.ceil(py1 * syScale) - sry
          const region = extractRegion(srcData, plan.srcW, plan.srcH, srx, sry, srw, srh)

          const tileBuf = await resampleRGBA(region, srw, srh, pw, ph, options.algorithm, undefined, cancelled)
          if (options.denoise > 0) await denoise(tileBuf, pw, ph, options.denoise, undefined, cancelled)
          if (options.edgeEnhance > 0) await edgeEnhance(tileBuf, pw, ph, options.edgeEnhance, undefined, cancelled)
          if (options.sharpen.amount > 0) await unsharpMask(tileBuf, pw, ph, options.sharpen, undefined, cancelled)

          /* 核心区域写入最终缓冲（注意 fill 模式的整体偏移） */
          for (let y = oy0; y < oy1; y++) {
            const srcRow = ((y - py0) * pw + (ox0 - px0)) * 4
            const dstRow = ((y + plan.dstY) * plan.outW + (ox0 + plan.dstX)) * 4
            finalBuf.set(
              tileBuf.subarray(srcRow, srcRow + (ox1 - ox0) * 4),
              dstRow,
            )
          }
          done++
          const f = done / total
          report(5 + f * 87, '分块处理', `Tile ${done} / ${total}`)
        }
      }
      report(92, '正在合成输出')
      ctx.putImageData(new ImageData(finalBuf, plan.outW, plan.outH), 0, 0)
    }

    if (cancelled?.()) throw new UpscaleCancelled()
    report(94, '正在编码输出')
    const outBlob = await encodeSurface(
      canvas,
      options.outputFormat,
      options.outputFormat === 'png' ? undefined : options.quality,
    )

    report(100, '完成')
    return {
      blob: outBlob,
      width: plan.outW,
      height: plan.outH,
      bytes: outBlob.size,
      format: options.outputFormat,
      durationMs: Date.now() - started,
      /* 以实际参与采样的源区域为基准，否则 crop 模式会把裁剪倍率算进放大倍率 */
      effectiveScale: Math.sqrt((plan.outW * plan.outH) / (plan.srcW * plan.srcH)),
      suffix: plan.suffix,
    }
  } finally {
    releaseBitmap(bitmap)
  }
}
