<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import ImageList from '../components/list/ImageList.vue'
import SettingsPanel from '../components/settings/SettingsPanel.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { useFileImport } from '../composables/useFileImport'
import { usePaste } from '../composables/usePaste'
import { useToast } from '../composables/useToast'
import { useImagesStore } from '../stores/images'
import { useSettingsStore, buildProcessOptions } from '../stores/settings'
import {
  createProcessor,
  defaultPoolSize,
  type ImageProcessor,
} from '../workers/pool'
import { downloadBlob, downloadResultsZip, resultFileName } from '../utils/download'
import type { ImageAsset, ProcessOptions } from '../core/types'
import { ACCEPTED_INPUT_TYPES } from '../core/sniff'
import ProgressOverlay from '../components/batch/ProgressOverlay.vue'
import ResultStats from '../components/results/ResultStats.vue'
import CompareViewer from '../components/preview/CompareViewer.vue'

defineEmits<{ backHome: [] }>()

const images = useImagesStore()
const { push } = useToast()
const { importFiles } = useFileImport()

const confirmVisible = ref(false)
const confirmReason = ref('')
let confirmResolve: ((ok: boolean) => void) | null = null

function askConfirm(reason: string): Promise<boolean> {
  confirmReason.value = reason
  confirmVisible.value = true
  return new Promise((resolve) => {
    confirmResolve = resolve
  })
}

function settleConfirm(ok: boolean) {
  confirmVisible.value = false
  confirmResolve?.(ok)
  confirmResolve = null
}

async function handleFiles(files: File[]) {
  await importFiles(files, {
    confirmOversize: askConfirm,
    onError: (msg) => push('error', msg),
  })
}
usePaste(handleFiles)

const addInputRef = ref<HTMLInputElement>()
function addMore() {
  if (!canEdit.value) return
  addInputRef.value?.click()
}
function onAddChange(e: Event) {
  const input = e.target as HTMLInputElement
  void handleFiles(Array.from(input.files ?? []))
  input.value = ''
}

function clearAll() {
  if (images.assets.length === 0 || !canEdit.value) return
  images.clearAll()
  push('info', '已清空全部图片')
}

/* 选中图原图预览 URL（无结果时用），随切换创建/回收 */
const previewUrl = ref('')
watchEffect((onCleanup) => {
  const asset = images.selected
  if (!asset || asset.resultUrl) return
  const url = URL.createObjectURL(asset.file)
  previewUrl.value = url
  onCleanup(() => URL.revokeObjectURL(url))
})

const settings = useSettingsStore()
const selected = computed(() => images.selected)

let processor: ImageProcessor | null = null
function getProcessor(): ImageProcessor {
  processor ??= createProcessor()
  return processor
}

const busy = computed(() => images.batch.active)
const canEdit = computed(() => !busy.value)

function suffixKind(): 'none' | 'compressed' | 'dimensions' {
  if (!settings.autoSuffix) return 'none'
  return settings.resizeEnabled && settings.width && settings.height
    ? 'dimensions'
    : 'compressed'
}

async function startProcessing() {
  if (images.assets.length === 0 || busy.value) return

  /* 参数校验：任何一张无法构建参数即整体拦截 */
  const prepared = new Map<string, ProcessOptions>()
  for (const asset of images.assets) {
    const options = buildProcessOptions(settings.$state, asset)
    if (!options) {
      push('error', '参数不完整：请检查目标大小设置或格式组合')
      return
    }
    prepared.set(asset.id, options)
  }

  images.resetResults()
  images.beginBatch(images.assets.length)

  let warnedUnreachable = false
  const waveSize = defaultPoolSize()
  const list = images.assets.slice()

  for (let i = 0; i < list.length; i += waveSize) {
    const wave = list.slice(i, i + waveSize)
    await Promise.all(wave.map((asset) => processOne(asset)))
  }

  images.finishBatch()
  push('success', `处理完成：成功 ${images.batch.successCount} 张${images.batch.failedCount ? `，失败 ${images.batch.failedCount} 张` : ''}`)

  async function processOne(asset: ImageAsset) {
    images.setStatus(asset.id, 'processing')
    images.advanceBatch(asset.name)
    try {
      const result = await getProcessor().process(asset.file, prepared.get(asset.id)!)
      images.setResult(asset.id, result)
      images.completeItem(true)
      if (!result.fitsTarget && !warnedUnreachable) {
        warnedUnreachable = true
        push('info', '部分图片即使最低质量也无法达到目标大小，已输出尽可能小的结果')
      }
    } catch (err) {
      images.setStatus(asset.id, 'failed', err instanceof Error ? err.message : '处理失败')
      images.completeItem(false)
    }
  }
}

const doneAssets = computed(() => images.assets.filter((a) => a.status === 'done' && a.result))

function downloadSelected() {
  const asset = images.selected
  if (!asset?.result) return
  downloadBlob(asset.result.blob, resultFileName(asset.name, asset.result, suffixKind()))
}

async function downloadZip() {
  if (doneAssets.value.length === 0) return
  await downloadResultsZip(
    doneAssets.value.map(({ name, result }) => ({ assetName: name, result: result! })),
    { suffixKind: suffixKind() },
  )
  push('success', `已打包 ${doneAssets.value.length} 张图片`)
}

function closeOverlay() {
  images.resetBatch()
}
</script>

<template>
  <div class="flex min-h-screen flex-col px-4 pb-4">
    <!-- 顶部工具栏 -->
    <header class="flex items-center justify-between py-3">
      <button
        class="text-sm text-slate-500 hover:text-brand-600"
        @click="$emit('backHome')"
      >
        ← 返回首页
      </button>
      <div class="flex items-center gap-2 text-sm text-slate-400">
        共 {{ images.assets.length }} 张
      </div>
    </header>

    <main class="grid min-h-0 flex-1 grid-cols-[280px_1fr_340px] gap-4">
      <!-- 左栏：列表 -->
      <aside class="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-2">
        <div class="mb-2 flex gap-2">
          <BaseButton variant="ghost" class="flex-1 !px-2 text-xs" @click="addMore">＋ 添加图片</BaseButton>
          <BaseButton variant="danger" class="!px-2 text-xs" :disabled="!canEdit" @click="clearAll">清空</BaseButton>
          <input
            ref="addInputRef"
            type="file"
            multiple
            :accept="ACCEPTED_INPUT_TYPES"
            class="hidden"
            @change="onAddChange"
          />
        </div>
        <ImageList v-if="images.assets.length > 0" class="min-h-0 flex-1" />
        <p v-else class="mt-10 self-center text-xs text-slate-300">暂无图片</p>
      </aside>

      <!-- 中栏：预览 -->
      <section class="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <template v-if="selected">
          <CompareViewer
            v-if="selected.result"
            :original="selected.file"
            :result="selected.result.blob"
            class="shrink-0"
          />
          <div
            v-else
            class="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white"
          >
            <img :src="previewUrl" class="max-h-[60vh] object-contain" alt="原图预览" />
          </div>
          <ResultStats v-if="selected.status === 'done'" :asset="selected" />
        </template>
        <div
          v-else
          class="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-400"
        >
          从左侧选择一张图片查看预览
        </div>
      </section>

      <!-- 右栏：参数面板 -->
      <aside class="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <SettingsPanel />
        <div class="sticky bottom-0 mt-3 space-y-2 bg-gradient-to-t from-slate-50 pt-2">
          <BaseButton
            class="w-full"
            :disabled="images.assets.length === 0 || busy"
            @click="startProcessing"
          >
            {{ busy ? '处理中…' : `开始处理（${images.assets.length} 张）` }}
          </BaseButton>
          <div v-if="selected && selected.status === 'done'" class="flex gap-2">
            <BaseButton
              variant="ghost"
              class="flex-1 !px-2 text-xs"
              :disabled="busy"
              @click="downloadSelected"
            >
              下载当前
            </BaseButton>
          </div>
          <BaseButton
            v-if="doneAssets.length > 1"
            variant="ghost"
            class="w-full !px-2 text-xs"
            :disabled="busy"
            @click="downloadZip"
          >
            下载全部 ZIP（{{ doneAssets.length }} 张）
          </BaseButton>
        </div>
      </aside>
    </main>

    <!-- 超大图确认框 -->
    <Teleport to="body">
      <div v-if="confirmVisible" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <div class="relative z-10 w-[min(92vw,420px)] rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-2 text-base font-semibold">检测到超大图片</h3>
          <p class="text-sm text-slate-600">{{ confirmReason }}</p>
          <p class="mt-1 text-sm text-slate-500">继续处理可能占用较多内存。</p>
          <div class="mt-5 flex justify-end gap-2">
            <BaseButton variant="ghost" @click="settleConfirm(false)">取消</BaseButton>
            <BaseButton @click="settleConfirm(true)">继续处理</BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <ProgressOverlay @download-zip="downloadZip" @close="closeOverlay" />
  </div>
</template>
