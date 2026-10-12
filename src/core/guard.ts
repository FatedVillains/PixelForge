/** 源文件体积上限：50MB */
export const GUARD_MAX_BYTES = 50 * 1024 * 1024
/** 源图像素上限：4000 万像素 */
export const GUARD_MAX_PIXELS = 40_000_000
/** 压缩管线输出单边上限（与 resize 的硬夹取一致） */
export const GUARD_MAX_OUTPUT_SIDE = 20_000
/**
 * 压缩管线输出像素上限（≈256MB RGBA）。
 * 该路径没有分块兜底，超过即极可能把渲染进程内存打爆。
 */
export const GUARD_MAX_OUTPUT_PIXELS = 64_000_000

export interface GuardResult {
  oversized: boolean
  reason?: string
}

function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1048576)}MB`
}

function tenThousands(pixels: number): string {
  return `${Math.round(pixels / 10_000)} 万像素`
}

export function checkBytesGuard(bytes: number): GuardResult {
  if (bytes > GUARD_MAX_BYTES) {
    return {
      oversized: true,
      reason: `文件大小 ${megabytes(bytes)} 超过 ${megabytes(GUARD_MAX_BYTES)}`,
    }
  }
  return { oversized: false }
}

export function checkPixelsGuard(width: number, height: number): GuardResult {
  if (width * height > GUARD_MAX_PIXELS) {
    return {
      oversized: true,
      reason: `图片尺寸 ${width}×${height} 超过 ${tenThousands(GUARD_MAX_PIXELS)}`,
    }
  }
  return { oversized: false }
}

/** 输出尺寸校验：压缩管线在编码前必须过这一关 */
export function checkOutputGuard(width: number, height: number): GuardResult {
  const side = Math.max(width, height)
  if (side > GUARD_MAX_OUTPUT_SIDE) {
    return {
      oversized: true,
      reason: `目标尺寸 ${width}×${height} 超过单边上限 ${GUARD_MAX_OUTPUT_SIDE}px`,
    }
  }
  if (width * height > GUARD_MAX_OUTPUT_PIXELS) {
    return {
      oversized: true,
      reason:
        `目标尺寸 ${width}×${height}（${tenThousands(width * height)}）` +
        `超过压缩模式上限 ${tenThousands(GUARD_MAX_OUTPUT_PIXELS)}；` +
        `压缩模式不支持分块处理，请降低目标尺寸或改用「专业高清放大」`,
    }
  }
  return { oversized: false }
}
