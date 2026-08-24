import { defineStore } from 'pinia'
import type { CompressMode, OutputFormat, ProcessOptions, ResizeOptions } from '../core/types'
import { computeTargetDimensions, type Dimensions } from '../core/processors/resize'

export interface SettingsState {
  outputFormat: OutputFormat
  mode: CompressMode
  quality: number
  targetPresetKb: number | null
  customTargetKb: number | null
  resizeEnabled: boolean
  width: number | null
  height: number | null
  keepAspectRatio: boolean
  autoSuffix: boolean
}

export const TARGET_PRESETS: Array<{ label: string; kb: number }> = [
  { label: '100 KB', kb: 100 },
  { label: '200 KB', kb: 200 },
  { label: '300 KB', kb: 300 },
  { label: '500 KB', kb: 500 },
  { label: '1 MB', kb: 1024 },
  { label: '2 MB', kb: 2048 },
]

export const QUICK_SIZES: Array<{ label: string; width: number; height: number }> = [
  { label: '640 × 480', width: 640, height: 480 },
  { label: '800 × 600', width: 800, height: 600 },
  { label: '1024 × 768', width: 1024, height: 768 },
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1280 × 960', width: 1280, height: 960 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '1920 × 1440', width: 1920, height: 1440 },
  { label: '2560 × 1440', width: 2560, height: 1440 },
  { label: '3840 × 2160', width: 3840, height: 2160 },
]

export const ID_PHOTO_PRESETS: Array<{ label: string; width: number; height: number }> = [
  { label: '一寸 295×413', width: 295, height: 413 },
  { label: '二寸 413×579', width: 413, height: 579 },
]

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    outputFormat: 'jpeg',
    mode: 'quality',
    quality: 80,
    targetPresetKb: 500,
    customTargetKb: null,
    resizeEnabled: false,
    width: null,
    height: null,
    keepAspectRatio: true,
    autoSuffix: true,
  }),
  actions: {
    setFormat(format: OutputFormat) {
      this.outputFormat = format
      if (format === 'png' && this.mode === 'targetSize') this.mode = 'quality'
    },
    setMode(mode: CompressMode) {
      this.mode = mode
    },
  },
})

/** 把 UI 设置映射为管线参数；参数不完整返回 null */
export function buildProcessOptions(
  s: SettingsState,
  original: Dimensions,
): ProcessOptions | null {
  if (s.mode === 'targetSize') {
    if (s.outputFormat === 'png') return null
    const kb = s.customTargetKb ?? s.targetPresetKb
    if (!kb || kb <= 0) return null
  }
  const options: ProcessOptions = {
    outputFormat: s.outputFormat,
    mode: s.mode,
  }
  if (s.mode === 'quality') {
    options.quality = Math.min(100, Math.max(1, Math.round(s.quality)))
  } else {
    const kb = (s.customTargetKb ?? s.targetPresetKb) as number
    options.targetSizeBytes = Math.round(kb * 1024)
  }
  if (s.resizeEnabled) {
    const dims = computeTargetDimensions(original, {
      width: s.width ?? 0,
      height: s.height ?? 0,
      keepAspectRatio: s.keepAspectRatio,
    })
    const resize: ResizeOptions = { ...dims, keepAspectRatio: s.keepAspectRatio }
    options.resize = resize
  }
  return options
}
