import type { OutputFormat } from '../types'

/** 重采样算法 */
export type UpscaleAlgorithm = 'lanczos' | 'bicubic' | 'bilinear' | 'nearest'

/** 比例处理模式 */
export type AspectMode = 'fit' | 'crop' | 'fill' | 'stretch'

/** 图片类型预设 */
export type ImagePreset =
  | 'auto'
  | 'photo'
  | 'portrait'
  | 'landscape'
  | 'anime'
  | 'pixel'
  | 'text'

/** 倍率 / 目标分辨率 两种设定方式 */
export type TargetMode = 'scale' | 'resolution' | 'custom'

export interface UpscaleTarget {
  mode: TargetMode
  /** mode = 'scale' */
  scale?: number
  /** mode = 'resolution'：目标长边像素（2K=2560, 4K=3840, 8K=7680, 16K=15360） */
  resolution?: number
  /** mode = 'custom' */
  width?: number
  height?: number
  keepAspectRatio: boolean
  aspectMode: AspectMode
}

export interface SharpenParams {
  /** 0 = 关闭 */
  amount: number
  radius: number
  threshold: number
}

export interface UpscaleOptions {
  target: UpscaleTarget
  algorithm: UpscaleAlgorithm
  /** 0-3：关 / 低 / 中 / 高 */
  denoise: number
  sharpen: SharpenParams
  /** 0-3：关 / 低 / 中 / 高 */
  edgeEnhance: number
  /** 0 = 自动 */
  tileSize: number
  tilePadding: number
  outputFormat: OutputFormat
  /** 1-100，仅 jpeg/webp */
  quality: number
}

export interface UpscaleResult {
  blob: Blob
  width: number
  height: number
  bytes: number
  format: OutputFormat
  durationMs: number
  /** 实际放大倍率（输出面积比的开方） */
  effectiveScale: number
  /** 输出命名后缀，例如 4x / 4K / 7680x4320 */
  suffix: string
}

/** 目标尺寸求解结果 */
export interface TargetPlan {
  outW: number
  outH: number
  /** 源图参与重采样的区域（crop 模式会裁剪） */
  srcX: number
  srcY: number
  srcW: number
  srcH: number
  /** fill 模式下重采样结果在输出画布中的偏移与尺寸 */
  dstX: number
  dstY: number
  dstW: number
  dstH: number
  suffix: string
}

export interface UpscaleProgress {
  percent: number
  stage: string
  /** 例如 Tile 3 / 12 */
  detail?: string
}

export type WorkerIn =
  | { type: 'upscale'; jobId: string; blob: Blob; options: UpscaleOptions }
  | { type: 'cancel'; jobId: string }

export type WorkerOut =
  | ({ type: 'progress'; jobId: string } & UpscaleProgress)
  | { type: 'done'; jobId: string; result: UpscaleResult }
  | { type: 'cancelled'; jobId: string }
  | { type: 'error'; jobId: string; message: string }

export class UpscaleCancelled extends Error {
  constructor() {
    super('已取消')
    this.name = 'UpscaleCancelled'
  }
}
