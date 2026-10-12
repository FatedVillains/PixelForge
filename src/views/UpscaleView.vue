<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import Dropzone from '../components/upload/Dropzone.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'
import NumberField from '../components/ui/NumberField.vue'
import RangeSlider from '../components/ui/RangeSlider.vue'
import SelectBox from '../components/ui/SelectBox.vue'
import ToggleSwitch from '../components/ui/ToggleSwitch.vue'
import UpscaleCompare from '../components/preview/UpscaleCompare.vue'
import { usePaste } from '../composables/usePaste'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { useToast } from '../composables/useToast'
import { decodeImage, releaseBitmap } from '../core/codec'
import { checkBytesGuard, checkPixelsGuard } from '../core/guard'
import { sniffFile } from '../core/sniff'
import { autoTileSize, estimateMemory } from '../core/upscale/memory'
import { IMAGE_PRESETS, resolvePreset, SHARPEN_LEVELS } from '../core/upscale/presets'
import { checkOutputLimits, RESOLUTION_PRESETS, solveTarget } from '../core/upscale/target'
import type {
  AspectMode,
  ImagePreset,
  UpscaleAlgorithm,
  UpscaleOptions,
  UpscaleResult,
} from '../core/upscale/types'
import { runUpscaleJob, type UpscaleJobHandle } from '../workers/upscaleClient'
import { formatBytes } from '../utils/format'
import {
  downloadBlob,
  downloadUpResults,
  upResultFileName,
  shouldUseZipUp,
} from '../utils/download'
import { ACCEPTED_INPUT_TYPES } from '../core/sniff'

defineEmits<{ backHome: [] }>()

const { push } = useToast()

interface UpAsset {
  id: string
  name: string
  bytes: number
  width: number
  height: number
  file: File
  previewUrl: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  error?: string
  result?: UpscaleResult
  resultUrl?: string
}

let idSeq = 0
const assets = ref<UpAsset[]>([])
const selectedId = ref<string | null>(null)
const selected = computed(() => assets.value.find((a) => a.id === selectedId.value) ?? null)

const { visible: confirmVisible, reason: confirmReason, ask: askConfirm, settle: settleConfirm } =
  useConfirmDialog()

async function handleFiles(files: File[]) {
  for (const file of files) {
    try {
      const format = await sniffFile(file)
      if (format === 'unknown') {
        push('error', `不支持的图片格式：${file.name}`)
        continue
      }
      /* 放大路径最吃内存，导入时必须与压缩页一样做体积/像素确认 */
      const bytesGuard = checkBytesGuard(file.size)
      if (bytesGuard.oversized) {
        if (!(await askConfirm(`${file.name}：${bytesGuard.reason}`))) continue
      }
      const decoded = await decodeImage(file)
      try {
        const pxGuard = checkPixelsGuard(decoded.width, decoded.height)
        if (pxGuard.oversized) {
          if (!(await askConfirm(`${file.name}：${pxGuard.reason}`))) continue
        }
        const asset: UpAsset = {
          id: `up_${Date.now().toString(36)}_${++idSeq}`,
          name: file.name || `粘贴图片.${format === 'jpeg' ? 'jpg' : format}`,
          bytes: file.size,
          width: decoded.width,
          height: decoded.height,
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'pending',
        }
        assets.value.push(asset)
        if (!selectedId.value) selectedId.value = asset.id
      } finally {
        releaseBitmap(decoded.bitmap)
      }
    } catch (err) {
      push('error', err instanceof Error ? err.message : `导入失败：${file.name}`)
    }
  }
}
usePaste(handleFiles)

function releaseAssetUrls(a: UpAsset): void {
  if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
  if (a.resultUrl) URL.revokeObjectURL(a.resultUrl)
}

function removeAsset(id: string) {
  const idx = assets.value.findIndex((a) => a.id === id)
  if (idx === -1) return
  const [a] = assets.value.splice(idx, 1)
  if (a) releaseAssetUrls(a)
  if (selectedId.value === id) selectedId.value = assets.value[0]?.id ?? null
}

/* ---------------- 设置 ---------------- */
const preset = ref<ImagePreset>('auto')
const targetMode = ref<'scale' | 'resolution' | 'custom'>('scale')
const scale = ref(4)
const resolution = ref(3840)
const customW = ref<number | null>(null)
const customH = ref<number | null>(null)
const lockAspect = ref(true)
const aspectMode = ref<AspectMode>('fit')
const algorithm = ref<UpscaleAlgorithm>('lanczos')
const denoiseLevel = ref(1)
const edgeLevel = ref(0)
const sharpenLevel = ref<'off' | 'low' | 'mid' | 'high' | 'custom'>('mid')
const sharpen = reactive({ amount: 0.8, radius: 1.0, threshold: 3 })
const tileSize = ref(0)
const tilePadding = ref(64)
const outputFormat = ref<'jpeg' | 'png' | 'webp'>('jpeg')
const quality = ref(95)

const SCALE_OPTIONS = [
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
  { value: '8', label: '8×' },
  { value: '16', label: '16×' },
]
const RESOLUTION_OPTIONS = [
  ...RESOLUTION_PRESETS.map((p) => ({ value: String(p.longSide), label: p.label })),
]
const ALGO_OPTIONS: Array<{ value: UpscaleAlgorithm; label: string }> = [
  { value: 'lanczos', label: 'Lanczos（默认，细节保持最好）' },
  { value: 'bicubic', label: 'Bicubic（平滑，适合人像）' },
  { value: 'bilinear', label: 'Bilinear（速度快）' },
  { value: 'nearest', label: 'Nearest Neighbor（像素画）' },
]
const ASPECT_OPTIONS: Array<{ value: AspectMode; label: string }> = [
  { value: 'fit', label: '保持比例' },
  { value: 'crop', label: '裁剪' },
  { value: 'fill', label: '填充' },
  { value: 'stretch', label: '拉伸' },
]
const LEVEL_OPTIONS = [
  { value: '0', label: '关闭' },
  { value: '1', label: '低' },
  { value: '2', label: '中' },
  { value: '3', label: '高' },
]
const SHARPEN_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '高' },
  { value: 'custom', label: '自定义' },
]
const TILE_SIZE_OPTIONS = [
  { value: '0', label: '自动' },
  { value: '512', label: '512' },
  { value: '1024', label: '1024' },
  { value: '2048', label: '2048' },
  { value: '4096', label: '4096' },
]
const TILE_PAD_OPTIONS = [
  { value: '0', label: '0' },
  { value: '32', label: '32' },
  { value: '64', label: '64（默认）' },
  { value: '128', label: '128' },
  { value: '256', label: '256' },
]
const FORMAT_OPTIONS = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG（无损）' },
  { value: 'webp', label: 'WEBP' },
]

/* 预设 → 参数 */
function applyPreset() {
  const dims = selected.value ?? { width: 1920, height: 1080 }
  const p = resolvePreset(preset.value, dims.width, dims.height)
  algorithm.value = p.algorithm
  denoiseLevel.value = p.denoise
  edgeLevel.value = p.edgeEnhance
  if (p.sharpen.amount <= 0) {
    sharpenLevel.value = 'off'
  } else {
    sharpen.amount = p.sharpen.amount
    sharpen.radius = p.sharpen.radius
    sharpen.threshold = p.sharpen.threshold
    sharpenLevel.value = 'custom'
    const idx = SHARPEN_LEVELS.findIndex(
      (l) =>
        l.value &&
        l.value.amount === p.sharpen.amount &&
        l.value.radius === p.sharpen.radius &&
        l.value.threshold === p.sharpen.threshold,
    )
    if (idx > 0) sharpenLevel.value = (['off', 'low', 'mid', 'high'] as const)[idx]!
  }
}

function onSharpenLevel(v: string) {
  sharpenLevel.value = v as typeof sharpenLevel.value
  const lv = SHARPEN_LEVELS[['off', 'low', 'mid', 'high'].indexOf(v)]
  if (lv?.value) {
    sharpen.amount = lv.value.amount
    sharpen.radius = lv.value.radius
    sharpen.threshold = lv.value.threshold
  }
}

function markCustomSharpen() {
  sharpenLevel.value = 'custom'
}

/* 自定义尺寸联动 */
function onCustomW(v: number | null) {
  customW.value = v
  if (lockAspect.value && v && selected.value) {
    customH.value = Math.max(1, Math.round((v * selected.value.height) / selected.value.width))
  }
}
function onCustomH(v: number | null) {
  customH.value = v
  if (lockAspect.value && v && selected.value) {
    customW.value = Math.max(1, Math.round((v * selected.value.width) / selected.value.height))
  }
}

function buildOptions(asset: UpAsset): UpscaleOptions {
  let finalAlgo = algorithm.value
  let finalDenoise = denoiseLevel.value
  let finalEdge = edgeLevel.value
  let finalSharpen = { ...sharpen }
  if (sharpenLevel.value === 'off') finalSharpen = { amount: 0, radius: 1, threshold: 0 }
  if (preset.value === 'auto') {
    const p = resolvePreset('auto', asset.width, asset.height)
    /* 自动模式下仅算法随图变化，其余尊重用户设置 */
    finalAlgo = algorithm.value === 'lanczos' ? p.algorithm : algorithm.value
    void finalDenoise
    void finalEdge
  }
  return {
    target: {
      mode: targetMode.value,
      scale: scale.value,
      resolution: resolution.value,
      width: customW.value ?? undefined,
      height: customH.value ?? undefined,
      keepAspectRatio: lockAspect.value,
      aspectMode: aspectMode.value,
    },
    algorithm: finalAlgo,
    denoise: finalDenoise,
    sharpen: finalSharpen,
    edgeEnhance: finalEdge,
    tileSize: tileSize.value,
    tilePadding: tilePadding.value,
    outputFormat: outputFormat.value,
    quality: quality.value,
  }
}

/* 目标预览 + 内存预估 */
const targetPreview = computed(() => {
  const a = selected.value
  if (!a) return null
  const plan = solveTarget(a.width, a.height, buildOptions(a).target)
  const limits = checkOutputLimits(plan.outW, plan.outH)
  const est = estimateMemory(plan.srcW, plan.srcH, plan.outW, plan.outH)
  const tiles = est.level !== 'ok'
  const ts = tileSize.value > 0 ? tileSize.value : autoTileSize(plan.dstW, plan.dstH)
  const tileCount = tiles
    ? Math.ceil(plan.dstW / ts) * Math.ceil(plan.dstH / ts)
    : 0
  return { plan, limits, est, tileCount }
})

/* ---------------- 处理 ---------------- */
const processing = ref(false)
const progress = reactive({ percent: 0, stage: '', detail: '', current: 0, total: 0, eta: '' })
let currentJob: UpscaleJobHandle | null = null
let cancelRequested = false

/* 卸载（切回首页）必须停掉正在跑的大图任务并回收 blob URL */
onUnmounted(() => {
  cancelRequested = true
  currentJob?.cancel()
  currentJob = null
  for (const a of assets.value) releaseAssetUrls(a)
  assets.value = []
})

async function startProcessing() {
  if (assets.value.length === 0 || processing.value) return
  const list = assets.value.slice()
  if (list.length === 0) return

  /* 预检 + 内存确认 */
  for (const asset of list) {
    const options = buildOptions(asset)
    const plan = solveTarget(asset.width, asset.height, options.target)
    const limits = checkOutputLimits(plan.outW, plan.outH)
    if (!limits.ok) {
      push('error', `${asset.name}：${limits.reason}`)
      return
    }
    if (limits.warn) {
      const ok = await askConfirm(`${asset.name}：${limits.reason}`)
      if (!ok) return
    }
    const est = estimateMemory(plan.srcW, plan.srcH, plan.outW, plan.outH)
    if (est.level === 'block') {
      push('error', `${asset.name}：预计需要约 ${(est.bytes / 1073741824).toFixed(1)} GB 内存，请降低目标分辨率`)
      return
    }
    if (est.level === 'tile' && est.bytes > 1024 * 1024 * 1024) {
      const ok = await askConfirm(
        `${asset.name}：目标 ${plan.outW}×${plan.outH}，预计内存约 ${(est.bytes / 1073741824).toFixed(1)} GB，将自动使用分块处理。`,
      )
      if (!ok) return
    }
  }

  processing.value = true
  cancelRequested = false
  progress.total = list.length
  progress.current = 0
  let success = 0
  let failed = 0

  for (const asset of list) {
    if (cancelRequested) break
    asset.status = 'processing'
    asset.error = undefined
    if (asset.resultUrl) {
      URL.revokeObjectURL(asset.resultUrl)
      asset.resultUrl = undefined
      asset.result = undefined
    }
    progress.current++
    progress.percent = 0
    progress.stage = '排队中'
    progress.detail = asset.name
    progress.eta = ''
    const startedAt = Date.now()

    const job = runUpscaleJob(asset.file, buildOptions(asset), (p) => {
      progress.percent = p.percent
      progress.stage = p.stage
      progress.detail = p.detail ? `${asset.name} · ${p.detail}` : asset.name
      if (p.percent > 3) {
        const elapsed = (Date.now() - startedAt) / 1000
        const remain = (elapsed / p.percent) * (100 - p.percent)
        progress.eta = remain > 1 ? `约 ${Math.ceil(remain)} 秒` : '即将完成'
      }
    })
    currentJob = job
    try {
      const result = await job.promise
      asset.result = result
      asset.resultUrl = URL.createObjectURL(result.blob)
      asset.status = 'done'
      success++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === '已取消') {
        asset.status = 'pending'
        cancelRequested = true
      } else {
        asset.status = 'failed'
        asset.error = msg
        failed++
      }
    } finally {
      currentJob = null
    }
  }

  processing.value = false
  if (cancelRequested) {
    push('info', `已取消。完成 ${success} 张${failed ? `，失败 ${failed} 张` : ''}`)
  } else {
    push('success', `处理完成：成功 ${success} 张${failed ? `，失败 ${failed} 张` : ''}`)
  }
}

function cancelProcessing() {
  cancelRequested = true
  currentJob?.cancel()
}

/* ---------------- 输出 ---------------- */
function outputName(asset: UpAsset): string {
  return upResultFileName(asset.name, asset.result!)
}

async function downloadSelected() {
  const a = selected.value
  if (!a?.result) return
  try {
    await downloadBlob(a.result.blob, outputName(a))
    push('success', '已保存')
  } catch (err) {
    push('error', `保存失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

const doneAssets = computed(() => assets.value.filter((a) => a.status === 'done' && a.result))
/** 只有一张时直接给文件，多张才值得打包；与压缩页共用 shouldUseZipUp 规则 */
const useZip = computed(() => shouldUseZipUp(doneAssets.value))
const zipping = ref(false)

async function downloadZip() {
  if (doneAssets.value.length === 0 || zipping.value) return
  try {
    zipping.value = true
    await downloadUpResults(doneAssets.value.map((a) => ({ assetName: a.name, result: a.result! })))
    push('success', `已打包 ${doneAssets.value.length} 张图片`)
  } catch (err) {
    push('error', `打包下载失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    zipping.value = false
  }
}

/**
 * 参数一改，已有结果就不再代表当前设置——立即作废。
 * 否则用户把格式从 JPG 改成 PNG 后下载，拿到的仍是旧的那批 JPEG。
 * watch 一组 ref 比在 18 个控件上逐个埋点更不容易漏。
 * 处理中不重置，避免与正在跑的任务互相覆盖状态。
 */
watch(
  [
    outputFormat,
    quality,
    preset,
    targetMode,
    scale,
    resolution,
    customW,
    customH,
    lockAspect,
    aspectMode,
    algorithm,
    denoiseLevel,
    edgeLevel,
    sharpenLevel,
    () => sharpen.amount,
    () => sharpen.radius,
    () => sharpen.threshold,
    tileSize,
    tilePadding,
  ],
  () => {
    if (processing.value) return
    for (const a of assets.value) {
      if (a.status === 'done' || a.status === 'failed') {
        if (a.resultUrl) URL.revokeObjectURL(a.resultUrl)
        a.result = undefined
        a.resultUrl = undefined
        a.status = 'pending'
        a.error = undefined
      }
    }
  },
)

/* 切换选中图时重置自定义尺寸输入，避免沿用上一张的比例 */
watch(selectedId, () => {
  customW.value = null
  customH.value = null
})
</script>

<template>
  <div class="flex min-h-screen flex-col px-4 pb-4">
    <header class="flex items-center justify-between py-3">
      <button class="text-sm text-slate-500 hover:text-brand-600" @click="$emit('backHome')">
        ← 返回首页
      </button>
      <div class="text-sm font-medium text-slate-600">
        专业高清放大
        <span class="ml-2 text-xs text-slate-400">Lanczos · 无 AI · 完全本地处理</span>
      </div>
      <div class="w-16 text-right text-sm text-slate-400">{{ assets.length }} 张</div>
    </header>

    <!-- 空状态：导入 -->
    <main v-if="assets.length === 0" class="flex flex-1 items-center justify-center">
      <div class="w-full max-w-2xl">
        <Dropzone @files="handleFiles" />
        <p class="mt-3 text-center text-xs text-slate-400">
          支持 2×/4×/8×/16× 与 2K/4K/8K/16K 输出 · 纯本地算法，不会真正恢复不存在的细节
        </p>
      </div>
    </main>

    <main v-else class="grid min-h-0 flex-1 grid-cols-[220px_1fr_340px] gap-4">
      <!-- 左栏：图片列表 -->
      <aside class="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-2">
        <div class="mb-2">
          <label
            class="block cursor-pointer rounded-lg border border-dashed border-slate-300 py-2 text-center text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600"
          >
            ＋ 添加图片
            <input
              type="file"
              multiple
              :accept="ACCEPTED_INPUT_TYPES"
              class="hidden"
              @change="(e) => { handleFiles(Array.from((e.target as HTMLInputElement).files ?? [])); (e.target as HTMLInputElement).value = '' }"
            />
          </label>
        </div>
        <div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
          <div
            v-for="a in assets"
            :key="a.id"
            class="group flex cursor-pointer items-center gap-2 rounded-lg p-1.5"
            :class="a.id === selectedId ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50'"
            @click="selectedId = a.id"
          >
            <img :src="a.previewUrl" class="h-10 w-10 rounded object-cover" draggable="false" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium text-slate-700">{{ a.name }}</p>
              <p class="text-[10px] text-slate-400">
                {{ a.width }}×{{ a.height }}
                <span v-if="a.status === 'done'" class="text-emerald-600">✓ 完成</span>
                <span v-else-if="a.status === 'failed'" class="text-red-500">✗ 失败</span>
                <span v-else-if="a.status === 'processing'" class="text-brand-600">处理中…</span>
              </p>
            </div>
            <button
              class="hidden text-xs text-slate-300 group-hover:block hover:text-red-500"
              @click.stop="removeAsset(a.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </aside>

      <!-- 中栏：预览 / 对比 -->
      <section class="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <template v-if="selected">
          <UpscaleCompare
            v-if="selected.result"
            :original="selected.file"
            :result="selected.result.blob"
            :result-width="selected.result.width"
            :result-height="selected.result.height"
            class="shrink-0"
          />
          <div
            v-else
            class="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white p-3"
          >
            <img :src="selected.previewUrl" class="max-h-[60vh] object-contain" alt="原图预览" />
          </div>

          <!-- Before / After 信息 -->
          <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="mb-1 text-xs font-medium text-slate-400">原图</p>
                <p class="text-slate-700">{{ selected.width }} × {{ selected.height }}</p>
                <p class="text-xs text-slate-400">{{ formatBytes(selected.bytes) }}</p>
              </div>
              <div v-if="selected.result">
                <p class="mb-1 text-xs font-medium text-brand-600">处理后</p>
                <p class="text-slate-700">
                  {{ selected.result.width }} × {{ selected.result.height }}
                  <span class="ml-1 text-xs text-slate-400">
                    放大 {{ selected.result.effectiveScale.toFixed(1) }}× ·
                    耗时 {{ (selected.result.durationMs / 1000).toFixed(1) }}s
                  </span>
                </p>
                <p class="text-xs text-slate-400">
                  {{ formatBytes(selected.bytes) }} → {{ formatBytes(selected.result.bytes) }}
                </p>
              </div>
              <div v-else-if="targetPreview">
                <p class="mb-1 text-xs font-medium text-slate-400">预计输出</p>
                <p class="text-slate-700">
                  {{ targetPreview.plan.outW }} × {{ targetPreview.plan.outH }}
                </p>
                <p class="text-xs text-slate-400">
                  预计内存约 {{ formatBytes(targetPreview.est.bytes) }}
                  <span v-if="targetPreview.tileCount > 0">
                    · 分块 {{ targetPreview.tileCount }} 块
                  </span>
                </p>
              </div>
            </div>
            <p v-if="selected.error" class="mt-2 text-xs text-red-500">{{ selected.error }}</p>
          </div>
        </template>
      </section>

      <!-- 右栏：参数 -->
      <aside class="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div class="space-y-4 text-sm">
          <div>
            <p class="mb-1 text-xs font-medium text-slate-500">图片类型</p>
            <SelectBox
              :model-value="preset"
              :options="IMAGE_PRESETS.map((p) => ({ value: p.value, label: p.label }))"
              :disabled="processing"
              @update:model-value="(v) => { preset = v as ImagePreset; applyPreset() }"
            />
          </div>

          <div>
            <p class="mb-1 text-xs font-medium text-slate-500">放大方式</p>
            <div class="mb-2 flex overflow-hidden rounded-lg border border-slate-200 text-xs">
              <button
                v-for="m in [
                  { v: 'scale', l: '按倍率' },
                  { v: 'resolution', l: '按分辨率' },
                  { v: 'custom', l: '自定义' },
                ]"
                :key="m.v"
                class="flex-1 px-2 py-1.5"
                :class="targetMode === m.v ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'"
                @click="targetMode = m.v as typeof targetMode"
              >
                {{ m.l }}
              </button>
            </div>
            <div v-if="targetMode === 'scale'" class="grid grid-cols-4 gap-1">
              <button
                v-for="s in SCALE_OPTIONS"
                :key="s.value"
                class="rounded-lg border px-2 py-1.5 text-xs"
                :class="
                  scale === Number(s.value)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600'
                "
                @click="scale = Number(s.value)"
              >
                {{ s.label }}
              </button>
            </div>
            <div v-else-if="targetMode === 'resolution'" class="grid grid-cols-4 gap-1">
              <button
                v-for="r in RESOLUTION_OPTIONS"
                :key="r.value"
                class="rounded-lg border px-2 py-1.5 text-xs"
                :class="
                  resolution === Number(r.value)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600'
                "
                @click="resolution = Number(r.value)"
              >
                {{ r.label }}
              </button>
            </div>
            <div v-else class="space-y-2">
              <div class="flex items-center gap-2">
                <NumberField
                  :model-value="customW"
                  placeholder="目标宽度"
                  :min="1"
                  :disabled="processing"
                  @update:model-value="onCustomW"
                />
                <span class="text-slate-400">×</span>
                <NumberField
                  :model-value="customH"
                  placeholder="目标高度"
                  :min="1"
                  :disabled="processing"
                  @update:model-value="onCustomH"
                />
              </div>
              <ToggleSwitch v-model="lockAspect" label="锁定宽高比" :disabled="processing" />
              <div v-if="!lockAspect">
                <p class="mb-1 text-xs text-slate-400">比例不同时</p>
                <SelectBox
                  :model-value="aspectMode"
                  :options="ASPECT_OPTIONS"
                  :disabled="processing"
                  @update:model-value="(v) => (aspectMode = v as AspectMode)"
                />
              </div>
            </div>
          </div>

          <div>
            <p class="mb-1 text-xs font-medium text-slate-500">重采样算法</p>
            <SelectBox
              :model-value="algorithm"
              :options="ALGO_OPTIONS"
              :disabled="processing"
              @update:model-value="(v) => (algorithm = v as UpscaleAlgorithm)"
            />
          </div>

          <div>
            <p class="mb-1 text-xs font-medium text-slate-500">锐化</p>
            <SelectBox
              :model-value="sharpenLevel"
              :options="SHARPEN_OPTIONS"
              :disabled="processing"
              @update:model-value="onSharpenLevel"
            />
            <div v-if="sharpenLevel === 'custom'" class="mt-2 space-y-2 rounded-lg bg-white p-2">
              <div>
                <p class="flex justify-between text-xs text-slate-400">
                  <span>Amount</span><span>{{ sharpen.amount.toFixed(1) }}</span>
                </p>
                <RangeSlider
                  :model-value="sharpen.amount"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  @update:model-value="(v) => { sharpen.amount = v; markCustomSharpen() }"
                />
              </div>
              <div>
                <p class="flex justify-between text-xs text-slate-400">
                  <span>Radius</span><span>{{ sharpen.radius.toFixed(1) }}</span>
                </p>
                <RangeSlider
                  :model-value="sharpen.radius"
                  :min="0.5"
                  :max="3"
                  :step="0.1"
                  @update:model-value="(v) => { sharpen.radius = v; markCustomSharpen() }"
                />
              </div>
              <div>
                <p class="flex justify-between text-xs text-slate-400">
                  <span>Threshold</span><span>{{ sharpen.threshold }}</span>
                </p>
                <RangeSlider
                  :model-value="sharpen.threshold"
                  :min="0"
                  :max="15"
                  :step="1"
                  @update:model-value="(v) => { sharpen.threshold = v; markCustomSharpen() }"
                />
              </div>
            </div>
          </div>

          <div>
            <p class="mb-1 text-xs font-medium text-slate-500">降噪</p>
            <SelectBox
              :model-value="String(denoiseLevel)"
              :options="LEVEL_OPTIONS"
              :disabled="processing"
              @update:model-value="(v) => (denoiseLevel = Number(v))"
            />
          </div>

          <div>
            <p class="mb-1 text-xs font-medium text-slate-500">边缘增强</p>
            <SelectBox
              :model-value="String(edgeLevel)"
              :options="LEVEL_OPTIONS"
              :disabled="processing"
              @update:model-value="(v) => (edgeLevel = Number(v))"
            />
          </div>

          <div>
            <p class="mb-1 text-xs font-medium text-slate-500">输出格式</p>
            <SelectBox
              :model-value="outputFormat"
              :options="FORMAT_OPTIONS"
              :disabled="processing"
              @update:model-value="(v) => (outputFormat = v as 'jpeg' | 'png' | 'webp')"
            />
            <div v-if="outputFormat !== 'png'" class="mt-2">
              <p class="flex justify-between text-xs text-slate-400">
                <span>质量</span><span>{{ quality }}</span>
              </p>
              <RangeSlider v-model="quality" :min="80" :max="100" :step="1" />
            </div>
          </div>

          <details class="rounded-lg border border-slate-200 bg-white p-2">
            <summary class="cursor-pointer text-xs font-medium text-slate-500">高级设置（分块）</summary>
            <div class="mt-2 space-y-2">
              <div>
                <p class="mb-1 text-xs text-slate-400">Tile Size</p>
                <SelectBox
                  :model-value="String(tileSize)"
                  :options="TILE_SIZE_OPTIONS"
                  :disabled="processing"
                  @update:model-value="(v) => (tileSize = Number(v))"
                />
              </div>
              <div>
                <p class="mb-1 text-xs text-slate-400">Tile Padding</p>
                <SelectBox
                  :model-value="String(tilePadding)"
                  :options="TILE_PAD_OPTIONS"
                  :disabled="processing"
                  @update:model-value="(v) => (tilePadding = Number(v))"
                />
              </div>
            </div>
            <div v-if="targetPreview && targetPreview.est.level === 'ok'" class="mt-2">
              <p class="text-[11px] leading-relaxed text-slate-400">
                当前输出未触发内存阈值，Tile 设置不生效（整图直通处理）。
              </p>
            </div>
          </details>

          <p class="text-[11px] leading-relaxed text-slate-400">
            本功能不使用 AI，不会凭空恢复原图中不存在的细节；目标是尽可能减少放大产生的模糊、锯齿与噪点。
          </p>
        </div>

        <div class="sticky bottom-0 mt-3 space-y-2 bg-gradient-to-t from-slate-50 pt-2">
          <BaseButton
            class="w-full"
            :disabled="assets.length === 0 || processing"
            @click="startProcessing"
          >
            {{ processing ? '处理中…' : `开始放大（${assets.length} 张）` }}
          </BaseButton>
          <div v-if="selected && selected.status === 'done'" class="flex gap-2">
            <BaseButton variant="ghost" class="flex-1 !px-2 text-xs" :disabled="processing" @click="downloadSelected">
              下载图片
            </BaseButton>
          </div>
          <BaseButton
            v-if="useZip"
            variant="ghost"
            class="w-full !px-2 text-xs"
            :disabled="processing || zipping"
            @click="downloadZip"
          >
            {{ zipping ? '正在打包…' : `下载全部 ZIP（${doneAssets.length} 张）` }}
          </BaseButton>
        </div>
      </aside>
    </main>

    <!-- 处理进度浮层 -->
    <Teleport to="body">
      <div v-if="processing" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <div class="relative z-10 w-[min(92vw,440px)] rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-3 text-base font-semibold">正在处理（{{ progress.current }}/{{ progress.total }}）</h3>
          <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-brand-600 transition-all"
              :style="{ width: progress.percent + '%' }"
            />
          </div>
          <div class="mt-2 flex justify-between text-xs text-slate-500">
            <span>{{ progress.stage }}<template v-if="progress.detail"> · {{ progress.detail }}</template></span>
            <span>{{ Math.round(progress.percent) }}%</span>
          </div>
          <p v-if="progress.eta" class="mt-1 text-xs text-slate-400">预计剩余：{{ progress.eta }}</p>
          <div class="mt-5 flex justify-end">
            <BaseButton variant="danger" @click="cancelProcessing">取消处理</BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 大内存确认 -->
    <ConfirmDialog
      :open="confirmVisible"
      title="内存占用提示"
      :reason="confirmReason"
      hint="当前操作预计需要较大内存，建议降低目标分辨率或保持分块处理。"
      @settle="settleConfirm"
    />
  </div>
</template>
