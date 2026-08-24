<script setup lang="ts">
import { ref } from 'vue'
import Dropzone from '../components/upload/Dropzone.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import AppDialog from '../components/ui/AppDialog.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { usePaste } from '../composables/usePaste'
import { useFileImport } from '../composables/useFileImport'
import { useToast } from '../composables/useToast'
import { useImagesStore } from '../stores/images'
import { BRAND } from '../content'

const emit = defineEmits<{ start: [] }>()
const images = useImagesStore()
const { push } = useToast()
const aboutOpen = ref(false)

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

const { importFiles } = useFileImport()

async function handleFiles(files: File[]) {
  await importFiles(files, {
    confirmOversize: askConfirm,
    onError: (msg) => push('error', msg),
  })
  if (images.hasAssets) emit('start')
}

usePaste(handleFiles)

const quickActions = [
  { icon: '🗜️', label: '图片压缩', desc: '按质量或目标大小压缩' },
  { icon: '📐', label: '尺寸调整', desc: '锁定比例修改宽高' },
  { icon: '🆔', label: '像素修改', desc: '严格输出目标像素' },
  { icon: '🔄', label: '格式转换', desc: 'JPG / PNG / WEBP' },
]
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
    <header class="flex items-center justify-between py-5">
      <div class="text-lg font-bold tracking-tight">
        像素匠 <span class="text-brand-600">PixelForge</span>
      </div>
      <button class="text-sm text-slate-500 hover:text-slate-800" @click="aboutOpen = true">
        关于
      </button>
    </header>

    <main class="flex flex-1 flex-col items-center pt-10 pb-16">
      <h1 class="text-center text-4xl font-bold tracking-tight text-slate-900">
        {{ BRAND.heroTitle }}
      </h1>
      <p class="mt-3 text-center text-slate-500">{{ BRAND.heroSub }} —— {{ BRAND.slogan }}</p>
      <p class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
        {{ BRAND.privacyNote }}
      </p>

      <div class="mt-8 w-full max-w-2xl">
        <Dropzone @files="handleFiles" />
        <p class="mt-3 text-center text-xs text-slate-400">{{ BRAND.formatsLine }}</p>
      </div>

      <section class="mt-14 w-full max-w-3xl">
        <h2 class="mb-4 text-center text-sm font-medium tracking-wide text-slate-400">快速操作</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BaseCard
            v-for="action in quickActions"
            :key="action.label"
            class="cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            @click="emit('start')"
          >
            <div class="text-2xl">{{ action.icon }}</div>
            <div class="mt-2 text-sm font-semibold text-slate-800">{{ action.label }}</div>
            <div class="mt-0.5 text-xs text-slate-400">{{ action.desc }}</div>
          </BaseCard>
        </div>
      </section>
    </main>

    <AppDialog :open="confirmVisible" title="检测到超大图片" @close="settleConfirm(false)">
      <p class="text-sm text-slate-600">{{ confirmReason }}</p>
      <p class="mt-1 text-sm text-slate-500">继续处理可能占用较多内存。</p>
      <div class="mt-5 flex justify-end gap-2">
        <BaseButton variant="ghost" @click="settleConfirm(false)">取消</BaseButton>
        <BaseButton @click="settleConfirm(true)">继续处理</BaseButton>
      </div>
    </AppDialog>

    <AppDialog :open="aboutOpen" :title="BRAND.about.title" @close="aboutOpen = false">
      <p class="text-sm text-slate-600">{{ BRAND.about.body }}</p>
      <p class="mt-2 text-sm text-slate-500">{{ BRAND.slogan }}</p>
      <div class="mt-5 flex justify-end">
        <BaseButton variant="ghost" @click="aboutOpen = false">关闭</BaseButton>
      </div>
    </AppDialog>
  </div>
</template>
