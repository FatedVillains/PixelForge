import { UpscaleCancelled } from './types'
import type { CancelFn, ProgressFn } from './resample'

async function tick(cancelled?: CancelFn): Promise<void> {
  if (cancelled?.()) throw new UpscaleCancelled()
  await new Promise((r) => setTimeout(r, 0))
  if (cancelled?.()) throw new UpscaleCancelled()
}

/** 单通道可分离盒式模糊（3 次盒式 ≈ 高斯），原地近似 */
function boxBlurPass(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  radius: number,
  horizontal: boolean,
): void {
  const size = horizontal ? w : h
  const lines = horizontal ? h : w
  const norm = 1 / (radius * 2 + 1)
  for (let line = 0; line < lines; line++) {
    for (let c = 0; c < 4; c++) {
      /* 滑动窗口 */
      let acc = 0
      for (let i = -radius; i <= radius; i++) {
        const p = Math.min(size - 1, Math.max(0, i))
        acc += src[horizontal ? (line * w + p) * 4 + c : (p * w + line) * 4 + c]!
      }
      for (let i = 0; i < size; i++) {
        dst[horizontal ? (line * w + i) * 4 + c : (i * w + line) * 4 + c] = acc * norm
        const addP = Math.min(size - 1, i + radius + 1)
        const subP = Math.max(0, i - radius)
        acc +=
          src[horizontal ? (line * w + addP) * 4 + c : (addP * w + line) * 4 + c]! -
          src[horizontal ? (line * w + subP) * 4 + c : (subP * w + line) * 4 + c]!
      }
    }
  }
}

/** 高斯近似模糊：返回 Float32 模糊副本 */
export async function gaussianBlur(
  data: Uint8ClampedArray | Float32Array,
  w: number,
  h: number,
  radius: number,
  cancelled?: CancelFn,
): Promise<Float32Array> {
  const r = Math.max(1, Math.round(radius))
  let a = new Float32Array(w * h * 4)
  a.set(data)
  let b = new Float32Array(w * h * 4)
  /* 三次盒式模糊逼近高斯 */
  const passes = 3
  const pr = Math.max(1, Math.round(r / 1.6))
  for (let p = 0; p < passes; p++) {
    boxBlurPass(a, b, w, h, pr, true)
    boxBlurPass(b, a, w, h, pr, false)
    if (p % 2 === 1) await tick(cancelled)
  }
  return a
}

const DENOISE_RADIUS = [0, 1, 2, 3] as const
const DENOISE_MIX = [0, 0.45, 0.65, 0.85] as const

/** 降噪：与轻度高斯模糊按比例混合，避免细节全失 */
export async function denoise(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  level: number,
  onProgress?: ProgressFn,
  cancelled?: CancelFn,
): Promise<void> {
  if (level <= 0) return
  const lv = Math.min(3, Math.round(level)) as 1 | 2 | 3
  const blurred = await gaussianBlur(data, w, h, DENOISE_RADIUS[lv], cancelled)
  const mix = DENOISE_MIX[lv]
  const keep = 1 - mix
  const n = w * h * 4
  const step = 1 << 20
  for (let i = 0; i < n; i += step) {
    const end = Math.min(n, i + step)
    for (let j = i; j < end; j++) {
      data[j] = data[j]! * keep + blurred[j]! * mix
    }
    onProgress?.(i / n)
    await tick(cancelled)
  }
}

export interface UnsharpParams {
  amount: number
  radius: number
  threshold: number
}

/** Unsharp Mask 锐化：放大后对最终尺寸执行 */
export async function unsharpMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  params: UnsharpParams,
  onProgress?: ProgressFn,
  cancelled?: CancelFn,
): Promise<void> {
  const amount = Math.min(2, Math.max(0, params.amount))
  if (amount <= 0) return
  const radius = Math.min(3, Math.max(0.5, params.radius))
  const threshold = Math.min(25, Math.max(0, params.threshold))
  const blurred = await gaussianBlur(data, w, h, radius, cancelled)
  const n = w * h * 4
  const step = 1 << 20
  for (let i = 0; i < n; i += step) {
    const end = Math.min(n, i + step)
    for (let j = i; j < end; j++) {
      if (j % 4 === 3) continue // alpha 不锐化
      const diff = data[j]! - blurred[j]!
      if (Math.abs(diff) > threshold) {
        data[j] = data[j]! + diff * amount
      }
    }
    onProgress?.(i / n)
    await tick(cancelled)
  }
}

const EDGE_STRENGTH = [0, 0.35, 0.6, 0.9] as const

/**
 * 边缘增强：Sobel 检测亮度边缘，仅在边缘区域叠加高通细节，
 * 避免平坦区域噪点被放大。
 */
export async function edgeEnhance(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  level: number,
  onProgress?: ProgressFn,
  cancelled?: CancelFn,
): Promise<void> {
  if (level <= 0 || w < 3 || h < 3) return
  const lv = Math.min(3, Math.round(level)) as 1 | 2 | 3
  const strength = EDGE_STRENGTH[lv]

  /* 亮度 */
  const luma = new Float32Array(w * h)
  for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
    luma[i] = data[p]! * 0.299 + data[p + 1]! * 0.587 + data[p + 2]! * 0.114
  }
  /* Sobel 边缘强度图 */
  const mask = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      const i = row + x
      const gx =
        -luma[i - w - 1]! - 2 * luma[i - 1]! - luma[i + w - 1]! +
        luma[i - w + 1]! + 2 * luma[i + 1]! + luma[i + w + 1]!
      const gy =
        -luma[i - w - 1]! - 2 * luma[i - w]! - luma[i - w + 1]! +
        luma[i + w - 1]! + 2 * luma[i + w]! + luma[i + w + 1]!
      const m = Math.sqrt(gx * gx + gy * gy) / 4
      mask[i] = Math.min(1, m / 64)
    }
    if (y % 512 === 0) {
      onProgress?.((y / h) * 0.6)
      await tick(cancelled)
    }
  }
  /* 高通细节 */
  const blurred = await gaussianBlur(data, w, h, 1, cancelled)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const m = mask[row + x]! * strength
      if (m <= 0.01) continue
      const p = (row + x) * 4
      data[p] = data[p]! + (data[p]! - blurred[p]!) * m
      data[p + 1] = data[p + 1]! + (data[p + 1]! - blurred[p + 1]!) * m
      data[p + 2] = data[p + 2]! + (data[p + 2]! - blurred[p + 2]!) * m
    }
    if (y % 512 === 0) {
      onProgress?.(0.6 + (y / h) * 0.4)
      await tick(cancelled)
    }
  }
}
