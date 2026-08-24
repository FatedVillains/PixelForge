<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import ImageList from '../components/list/ImageList.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { useFileImport } from '../composables/useFileImport'
import { usePaste } from '../composables/usePaste'
import { useToast } from '../composables/useToast'
import { useImagesStore } from '../stores/images'
import { ACCEPTED_INPUT_TYPES } from '../core/sniff'

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
  addInputRef.value?.click()
}
function onAddChange(e: Event) {
  const input = e.target as HTMLInputElement
  void handleFiles(Array.from(input.files ?? []))
  input.value = ''
}

function clearAll() {
  if (images.assets.length === 0) return
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

const selectedPreviewSrc = computed(() => images.selected?.resultUrl || previewUrl.value)
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
          <BaseButton variant="danger" class="!px-2 text-xs" @click="clearAll">清空</BaseButton>
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
      <section class="flex min-h-0 flex-col gap-3">
        <div
          v-if="images.selected"
          class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <img :src="selectedPreviewSrc" class="max-h-full max-w-full object-contain" alt="预览" />
        </div>
        <div
          v-else
          class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-400"
        >
          从左侧选择一张图片查看预览
        </div>
        <!-- 参数区占位：Task 12 替换 -->
      </section>

      <!-- 右栏：参数面板占位 -->
      <aside class="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
        参数面板（Task 12）
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
  </div>
</template>
