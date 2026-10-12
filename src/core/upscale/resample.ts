import type { UpscaleAlgorithm } from './types'
import { UpscaleCancelled } from './types'

export interface RGBABuffer {
  data: Uint8ClampedArray
  width: number
  height: number
}

export type ProgressFn = (fraction: number) => void
export type CancelFn = () => boolean

interface KernelDef {
  support: number
  fn: (x: number) => number
}

function sinc(x: number): number {
  if (x === 0) return 1
  const px = Math.PI * x
  return Math.sin(px) / px
}

const KERNELS: Record<UpscaleAlgorithm, KernelDef> = {
  nearest: {
    support: 0.5,
    fn: (x) => (Math.abs(x) <= 0.5 ? 1 : 0),
  },
  bilinear: {
    support: 1,
    fn: (x) => {
      const a = Math.abs(x)
      return a < 1 ? 1 - a : 0
    },
  },
  /* Catmull-Rom (a = -0.5) */
  bicubic: {
    support: 2,
    fn: (x) => {
      const a = Math.abs(x)
      if (a < 1) return 1.5 * a * a * a - 2.5 * a * a + 1
      if (a < 2) return -0.5 * a * a * a + 2.5 * a * a - 4 * a + 2
      return 0
    },
  },
  /* Lanczos-3 */
  lanczos: {
    support: 3,
    fn: (x) => {
      const a = Math.abs(x)
      if (a >= 3) return 0
      return sinc(x) * sinc(x / 3)
    },
  },
}

interface AxisWeights {
  taps: number
  /** dstSize * taps，已归一化 */
  weights: Float32Array
  /** dstSize * taps，源像素起始下标 */
  indices: Int32Array
}

/** 预计算一条轴上每个输出像素的采样权重 */
function buildAxisWeights(srcSize: number, dstSize: number, kernel: KernelDef): AxisWeights {
  const scale = dstSize / srcSize
  /* 缩小时加宽核以抗锯齿；放大时 filterScale=1 */
  const filterScale = Math.max(1, 1 / scale)
  const support = kernel.support * filterScale
  const taps = Math.max(1, Math.ceil(support) * 2 + 1)
  const weights = new Float32Array(dstSize * taps)
  const indices = new Int32Array(dstSize * taps)

  for (let i = 0; i < dstSize; i++) {
    const center = (i + 0.5) / scale - 0.5
    const lo = Math.ceil(center - support)
    const hi = Math.floor(center + support)
    let sum = 0
    let n = 0
    const base = i * taps
    for (let j = lo; j <= hi && n < taps; j++, n++) {
      const w = kernel.fn((center - j) / filterScale)
      weights[base + n] = w
      indices[base + n] = Math.min(srcSize - 1, Math.max(0, j))
      sum += w
    }
    if (sum !== 0) {
      for (let k = 0; k < n; k++) weights[base + k] /= sum
    } else {
      /* 保底：最近邻 */
      weights[base] = 1
      indices[base] = Math.min(srcSize - 1, Math.max(0, Math.round(center)))
      n = 1
    }
    /* 尾部多余 tap 置零权重并指向第一个采样点 */
    for (let k = n; k < taps; k++) {
      weights[base + k] = 0
      indices[base + k] = indices[base]
    }
  }
  return { taps, weights, indices }
}

const YIELD_EVERY_ROWS = 64

async function tick(cancelled?: CancelFn): Promise<void> {
  if (cancelled?.()) throw new UpscaleCancelled()
  await new Promise((r) => setTimeout(r, 0))
  if (cancelled?.()) throw new UpscaleCancelled()
}

/**
 * 高质量可分离重采样（水平 + 垂直两遍）。
 * 中间缓冲为 Float32，避免两遍之间精度损失。
 */
export async function resampleRGBA(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  algorithm: UpscaleAlgorithm,
  onProgress?: ProgressFn,
  cancelled?: CancelFn,
): Promise<Uint8ClampedArray> {
  const kernel = KERNELS[algorithm]

  /* 最近邻走快速路径 */
  if (algorithm === 'nearest') {
    return resampleNearest(src, srcW, srcH, dstW, dstH, onProgress, cancelled)
  }

  const wx = buildAxisWeights(srcW, dstW, kernel)
  const wy = buildAxisWeights(srcH, dstH, kernel)

  /* 水平 pass：srcW×srcH → dstW×srcH（Float32） */
  const tmp = new Float32Array(dstW * srcH * 4)
  const xt = wx.taps
  for (let y = 0; y < srcH; y++) {
    const srcRow = y * srcW * 4
    const dstRow = y * dstW * 4
    for (let x = 0; x < dstW; x++) {
      const base = x * xt
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let k = 0; k < xt; k++) {
        const w = wx.weights[base + k]!
        if (w === 0) continue
        const si = (srcRow + wx.indices[base + k]! * 4) as number
        r += w * src[si]!
        g += w * src[si + 1]!
        b += w * src[si + 2]!
        a += w * src[si + 3]!
      }
      const di = dstRow + x * 4
      tmp[di] = r
      tmp[di + 1] = g
      tmp[di + 2] = b
      tmp[di + 3] = a
    }
    if (y % YIELD_EVERY_ROWS === 0) {
      onProgress?.((y / srcH) * 0.5)
      if (y % (YIELD_EVERY_ROWS * 8) === 0) await tick(cancelled)
    }
  }

  /* 垂直 pass：dstW×srcH → dstW×dstH（Uint8，截断负瓣超调） */
  const out = new Uint8ClampedArray(dstW * dstH * 4)
  const yt = wy.taps
  for (let y = 0; y < dstH; y++) {
    const base = y * yt
    const dstRow = y * dstW * 4
    for (let x = 0; x < dstW; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let k = 0; k < yt; k++) {
        const w = wy.weights[base + k]!
        if (w === 0) continue
        const si = (wy.indices[base + k]! * dstW + x) * 4
        r += w * tmp[si]!
        g += w * tmp[si + 1]!
        b += w * tmp[si + 2]!
        a += w * tmp[si + 3]!
      }
      const di = dstRow + x * 4
      out[di] = r
      out[di + 1] = g
      out[di + 2] = b
      out[di + 3] = a
    }
    if (y % YIELD_EVERY_ROWS === 0) {
      onProgress?.(0.5 + (y / dstH) * 0.5)
      if (y % (YIELD_EVERY_ROWS * 8) === 0) await tick(cancelled)
    }
  }
  return out
}

async function resampleNearest(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  onProgress?: ProgressFn,
  cancelled?: CancelFn,
): Promise<Uint8ClampedArray> {
  const out = new Uint8ClampedArray(dstW * dstH * 4)
  const xMap = new Int32Array(dstW)
  for (let x = 0; x < dstW; x++) {
    xMap[x] = Math.min(srcW - 1, Math.floor(((x + 0.5) * srcW) / dstW))
  }
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor(((y + 0.5) * srcH) / dstH))
    const srcRow = sy * srcW * 4
    const dstRow = y * dstW * 4
    for (let x = 0; x < dstW; x++) {
      const si = srcRow + xMap[x]! * 4
      const di = dstRow + x * 4
      out[di] = src[si]!
      out[di + 1] = src[si + 1]!
      out[di + 2] = src[si + 2]!
      out[di + 3] = src[si + 3]!
    }
    if (y % 256 === 0) {
      onProgress?.(y / dstH)
      if (y % 2048 === 0) await tick(cancelled)
    }
  }
  return out
}
