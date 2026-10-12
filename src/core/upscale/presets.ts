import type { ImagePreset, UpscaleAlgorithm } from './types'

export interface PresetParams {
  algorithm: UpscaleAlgorithm
  denoise: number
  sharpen: { amount: number; radius: number; threshold: number }
  edgeEnhance: number
}

export const SHARPEN_LEVELS: Array<{ label: string; value: PresetParams['sharpen'] | null }> = [
  { label: '关闭', value: null },
  { label: '低', value: { amount: 0.4, radius: 0.8, threshold: 2 } },
  { label: '中', value: { amount: 0.8, radius: 1.0, threshold: 3 } },
  { label: '高', value: { amount: 1.2, radius: 1.5, threshold: 4 } },
]

export const IMAGE_PRESETS: Array<{ value: ImagePreset; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'photo', label: '照片' },
  { value: 'portrait', label: '人像' },
  { value: 'landscape', label: '风景' },
  { value: 'anime', label: '动漫 / 插画' },
  { value: 'pixel', label: '像素画' },
  { value: 'text', label: '文字 / UI' },
]

const PRESET_TABLE: Record<Exclude<ImagePreset, 'auto'>, PresetParams> = {
  photo: {
    algorithm: 'lanczos',
    denoise: 1,
    sharpen: { amount: 0.8, radius: 1.0, threshold: 3 },
    edgeEnhance: 0,
  },
  portrait: {
    algorithm: 'lanczos',
    denoise: 1,
    sharpen: { amount: 0.4, radius: 0.8, threshold: 2 },
    edgeEnhance: 0,
  },
  landscape: {
    algorithm: 'lanczos',
    denoise: 1,
    sharpen: { amount: 0.8, radius: 1.0, threshold: 3 },
    edgeEnhance: 2,
  },
  anime: {
    algorithm: 'lanczos',
    denoise: 1,
    sharpen: { amount: 0.8, radius: 1.0, threshold: 3 },
    edgeEnhance: 2,
  },
  pixel: {
    algorithm: 'nearest',
    denoise: 0,
    sharpen: { amount: 0, radius: 1, threshold: 0 },
    edgeEnhance: 0,
  },
  text: {
    algorithm: 'lanczos',
    denoise: 0,
    sharpen: { amount: 0.8, radius: 1.0, threshold: 3 },
    edgeEnhance: 3,
  },
}

/**
 * 解析预设为具体参数。
 * auto：小图/无法判断时按“照片”处理；宽高比极端（长图/UI 截图类）按文字处理。
 */
export function resolvePreset(
  preset: ImagePreset,
  srcW: number,
  srcH: number,
): PresetParams {
  if (preset !== 'auto') return PRESET_TABLE[preset]
  const ratio = Math.max(srcW, srcH) / Math.max(1, Math.min(srcW, srcH))
  if (ratio > 3) return PRESET_TABLE.text
  return PRESET_TABLE.photo
}
