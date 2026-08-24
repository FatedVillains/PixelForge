export const GUARD_MAX_PIXELS = 40_000_000
export const GUARD_MAX_BYTES = 50 * 1024 * 1024

export interface GuardResult {
  oversized: boolean
  reason?: string
}

export function checkBytesGuard(bytes: number): GuardResult {
  if (bytes > GUARD_MAX_BYTES) {
    return {
      oversized: true,
      reason: `文件大小 ${Math.round(bytes / 1048576)}MB 超过 50MB`,
    }
  }
  return { oversized: false }
}

export function checkPixelsGuard(width: number, height: number): GuardResult {
  const pixels = width * height
  if (pixels > GUARD_MAX_PIXELS) {
    return {
      oversized: true,
      reason: `图片尺寸 ${width}×${height} 超过 4000 万像素`,
    }
  }
  return { oversized: false }
}
