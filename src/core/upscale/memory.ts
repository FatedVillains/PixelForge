/** 内存预估与 Tile 参数自动选择 */

export interface MemoryEstimate {
  bytes: number
  pixels: number
  /** ok: 直接处理；tile: 建议/强制分块；block: 超出安全范围 */
  level: 'ok' | 'tile' | 'block'
  reason?: string
}

/** 非分块路径允许的中间内存上限（约 768MB） */
const DIRECT_LIMIT = 768 * 1024 * 1024
/** 分块路径允许的峰值上限（约 1.5GB） */
const TILE_LIMIT = 1536 * 1024 * 1024
/** 输出像素超过该值时分块（≈ 3200 万像素） */
export const TILE_PIXEL_THRESHOLD = 32_000_000

/**
 * 预估整图直通路径峰值内存：
 * 源 RGBA + 水平 Float32 中间缓冲(dstW×srcH×16B) + 输出 RGBA + 滤镜模糊副本(16B/px)
 */
export function estimateMemory(
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
): MemoryEstimate {
  const pixels = outW * outH
  const srcBytes = srcW * srcH * 4
  const horizontalFloat = outW * srcH * 16
  const outBytes = pixels * 4
  const filterFloat = pixels * 16
  const peak = srcBytes + Math.max(horizontalFloat + outBytes, outBytes + filterFloat)

  if (peak > TILE_LIMIT && pixels <= TILE_PIXEL_THRESHOLD) {
    /* 不太常见：宽度极大的长条图 */
    return { bytes: peak, pixels, level: 'tile', reason: '中间缓冲过大，将使用分块处理' }
  }
  if (pixels > TILE_PIXEL_THRESHOLD) {
    return {
      bytes: peak,
      pixels,
      level: peak > TILE_LIMIT * 4 ? 'block' : 'tile',
      reason:
        peak > TILE_LIMIT * 4
          ? '预计内存占用过高，建议降低目标分辨率'
          : '输出较大，将使用分块处理以降低内存占用',
    }
  }
  if (peak > DIRECT_LIMIT) {
    return { bytes: peak, pixels, level: 'tile', reason: '内存占用较高，将使用分块处理' }
  }
  return { bytes: peak, pixels, level: 'ok' }
}

/** 根据输出尺寸自动选择 tileSize（输出像素坐标系） */
export function autoTileSize(outW: number, outH: number): number {
  const pixels = outW * outH
  if (pixels <= 64_000_000) return 2048
  if (pixels <= 150_000_000) return 1024
  return 512
}
