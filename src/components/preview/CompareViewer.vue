<script setup lang="ts">
import { ref, watchEffect } from 'vue'

const props = defineProps<{ original: Blob; result: Blob }>()

const mode = ref<'slider' | 'split'>('slider')
const pos = ref(50)
const container = ref<HTMLDivElement | null>(null)
const dragging = ref(false)

const originalUrl = ref('')
const resultUrl = ref('')

watchEffect((onCleanup) => {
  const o = URL.createObjectURL(props.original)
  const r = URL.createObjectURL(props.result)
  originalUrl.value = o
  resultUrl.value = r
  onCleanup(() => {
    URL.revokeObjectURL(o)
    URL.revokeObjectURL(r)
  })
})

function pointerPos(e: PointerEvent): number {
  const el = container.value
  if (!el) return pos.value
  const rect = el.getBoundingClientRect()
  return Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
}

function onDown(e: PointerEvent) {
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  pos.value = pointerPos(e)
}
function onMove(e: PointerEvent) {
  if (dragging.value) pos.value = pointerPos(e)
}
function onUp() {
  dragging.value = false
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <p class="text-sm text-slate-500">原图 / 处理后 对比</p>
      <div class="flex overflow-hidden rounded-lg border border-slate-200 text-xs">
        <button
          class="px-3 py-1"
          :class="mode === 'slider' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'"
          @click="mode = 'slider'"
        >
          滑块对比
        </button>
        <button
          class="px-3 py-1"
          :class="mode === 'split' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'"
          @click="mode = 'split'"
        >
          左右并排
        </button>
      </div>
    </div>

    <div v-if="mode === 'split'" class="grid grid-cols-2 gap-2">
      <figure class="overflow-hidden rounded-xl border border-slate-100">
        <figcaption class="bg-slate-800 px-2 py-1 text-center text-xs text-white">原图</figcaption>
        <div class="flex h-[380px] items-center justify-center bg-slate-50">
          <img :src="originalUrl" class="max-h-full max-w-full object-contain" draggable="false" />
        </div>
      </figure>
      <figure class="overflow-hidden rounded-xl border border-slate-100">
        <figcaption class="bg-brand-600 px-2 py-1 text-center text-xs text-white">处理后</figcaption>
        <div class="flex h-[380px] items-center justify-center bg-slate-50">
          <img :src="resultUrl" class="max-h-full max-w-full object-contain" draggable="false" />
        </div>
      </figure>
    </div>

    <div
      v-else
      ref="container"
      class="relative h-[420px] cursor-ew-resize touch-none overflow-hidden rounded-xl bg-slate-50 select-none"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <img
        :src="resultUrl"
        class="absolute inset-0 mx-auto h-full w-auto max-w-none object-contain"
        style="left: 50%; transform: translateX(-50%)"
        draggable="false"
      />
      <img
        :src="originalUrl"
        class="absolute inset-0 mx-auto h-full w-auto max-w-none object-contain"
        style="left: 50%; transform: translateX(-50%)"
        :style="{ clipPath: `inset(0 ${100 - pos}% 0 0)` }"
        draggable="false"
      />
      <div
        class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-md"
        :style="{ left: pos + '%' }"
      >
        <span
          class="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs text-slate-500 shadow-md"
        >
          ⇄
        </span>
      </div>
      <span class="absolute top-2 left-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-xs text-white">原图</span>
      <span class="absolute top-2 right-2 rounded bg-brand-600/90 px-1.5 py-0.5 text-xs text-white">处理后</span>
    </div>
  </div>
</template>
