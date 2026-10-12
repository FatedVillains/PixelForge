<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'

const props = defineProps<{
  original: Blob
  result: Blob
  resultWidth: number
  resultHeight: number
}>()

type ViewMode = 'slider' | 'split' | 'original' | 'result'
const mode = ref<ViewMode>('slider')
const pos = ref(50)

/* 缩放：fit 或具体倍率（相对处理后图像的实际像素） */
type Zoom = 'fit' | 0.5 | 1 | 2 | 4 | 8
const zoom = ref<Zoom>('fit')
const ZOOM_OPTIONS: Array<{ value: Zoom; label: string }> = [
  { value: 'fit', label: '适应窗口' },
  { value: 0.5, label: '50%' },
  { value: 1, label: '100%' },
  { value: 2, label: '200%' },
  { value: 4, label: '400%' },
  { value: 8, label: '800%' },
]

const container = ref<HTMLDivElement | null>(null)
const fitScale = ref(1)
function updateFitScale() {
  const el = container.value
  if (!el || props.resultWidth <= 0) return
  const s = Math.min(
    el.clientWidth / props.resultWidth,
    el.clientHeight / props.resultHeight,
    1,
  )
  fitScale.value = s > 0 && Number.isFinite(s) ? s : 1
}

const displayScale = computed(() => (zoom.value === 'fit' ? fitScale.value : zoom.value))
const displayW = computed(() => Math.max(1, Math.round(props.resultWidth * displayScale.value)))
const displayH = computed(() => Math.max(1, Math.round(props.resultHeight * displayScale.value)))

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

watch([() => props.result, zoom, mode], () => {
  requestAnimationFrame(updateFitScale)
})

/* 滑块对比拖动 */
const dragging = ref(false)
function pointerPos(e: PointerEvent): number {
  const el = container.value
  if (!el) return pos.value
  const rect = el.getBoundingClientRect()
  return Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
}
function onDown(e: PointerEvent) {
  if (mode.value !== 'slider' || zoom.value !== 'fit') return
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

/* 缩放模式下拖拽平移（滚动容器） */
const panning = ref(false)
let panStart = { x: 0, y: 0, left: 0, top: 0 }
function panDown(e: PointerEvent) {
  if (zoom.value === 'fit') return
  const el = container.value
  if (!el) return
  panning.value = true
  panStart = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function panMove(e: PointerEvent) {
  if (!panning.value) return
  const el = container.value
  if (!el) return
  el.scrollLeft = panStart.left - (e.clientX - panStart.x)
  el.scrollTop = panStart.top - (e.clientY - panStart.y)
}
function panUp() {
  panning.value = false
}

const isFit = computed(() => zoom.value === 'fit')
const currentZoomLabel = computed(() =>
  zoom.value === 'fit' ? `适应窗口（约 ${Math.round(fitScale.value * 100)}%）` : `${zoom.value * 100}%`,
)
</script>

<template>
  <div>
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-slate-500">原图 / 处理后 对比</p>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex overflow-hidden rounded-lg border border-slate-200 text-xs">
          <button
            v-for="m in [
              { v: 'slider', l: '滑动对比' },
              { v: 'split', l: '左右对比' },
              { v: 'original', l: '原图' },
              { v: 'result', l: '处理后' },
            ]"
            :key="m.v"
            class="px-3 py-1"
            :class="mode === m.v ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'"
            @click="mode = m.v as ViewMode"
          >
            {{ m.l }}
          </button>
        </div>
        <div class="flex overflow-hidden rounded-lg border border-slate-200 text-xs">
          <button
            v-for="z in ZOOM_OPTIONS"
            :key="String(z.value)"
            class="px-2.5 py-1"
            :class="zoom === z.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'"
            @click="zoom = z.value"
          >
            {{ z.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 左右对比 -->
    <div v-if="mode === 'split'" class="grid grid-cols-2 gap-2">
      <figure class="overflow-hidden rounded-xl border border-slate-100">
        <figcaption class="bg-slate-800 px-2 py-1 text-center text-xs text-white">原图</figcaption>
        <div class="flex h-[380px] items-center justify-center bg-slate-50">
          <img :src="originalUrl" class="max-h-full max-w-full object-contain" draggable="false" />
        </div>
      </figure>
      <figure class="overflow-hidden rounded-xl border border-slate-100">
        <figcaption class="bg-brand-600 px-2 py-1 text-center text-xs text-white">
          处理后（{{ resultWidth }}×{{ resultHeight }}）
        </figcaption>
        <div class="flex h-[380px] items-center justify-center bg-slate-50">
          <img :src="resultUrl" class="max-h-full max-w-full object-contain" draggable="false" />
        </div>
      </figure>
    </div>

    <!-- 单图 / 滑块（支持缩放与拖动查看局部） -->
    <div
      v-else
      ref="container"
      class="relative h-[440px] touch-none overflow-auto rounded-xl bg-slate-50 select-none"
      :class="[
        mode === 'slider' && isFit ? 'cursor-ew-resize' : '',
        !isFit ? (panning ? 'cursor-grabbing' : 'cursor-grab') : '',
      ]"
      @pointerdown="(e) => { onDown(e); panDown(e) }"
      @pointermove="(e) => { onMove(e); panMove(e) }"
      @pointerup="() => { onUp(); panUp() }"
      @pointercancel="() => { onUp(); panUp() }"
    >
      <div
        class="relative"
        :style="
          isFit
            ? { width: '100%', height: '100%' }
            : { width: displayW + 'px', height: displayH + 'px', margin: 'auto' }
        "
      >
        <template v-if="mode !== 'original'">
          <img
            :src="resultUrl"
            alt="处理后"
            class="select-none"
            :style="
              isFit
                ? { position: 'absolute', inset: '0', margin: 'auto', maxWidth: '100%', maxHeight: '100%' }
                : { width: displayW + 'px', height: displayH + 'px' }
            "
            draggable="false"
          />
        </template>
        <template v-if="mode === 'original' || mode === 'slider'">
          <img
            :src="originalUrl"
            alt="原图"
            class="select-none"
            :style="[
              isFit
                ? { position: 'absolute', inset: '0', margin: 'auto', maxWidth: '100%', maxHeight: '100%' }
                : { position: 'absolute', left: '0', top: '0', width: displayW + 'px', height: displayH + 'px' },
              mode === 'slider' ? { clipPath: `inset(0 ${100 - pos}% 0 0)` } : {},
            ]"
            draggable="false"
          />
        </template>
        <div
          v-if="mode === 'slider'"
          class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-md"
          :style="{ left: pos + '%' }"
        >
          <span
            class="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs text-slate-500 shadow-md"
          >
            ⇄
          </span>
        </div>
      </div>
      <span
        v-if="mode === 'slider'"
        class="absolute top-2 left-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-xs text-white"
        >原图</span
      >
      <span
        v-if="mode === 'slider'"
        class="absolute top-2 right-2 rounded bg-brand-600/90 px-1.5 py-0.5 text-xs text-white"
        >处理后</span
      >
      <span
        class="absolute bottom-2 right-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-xs text-white"
        >{{ currentZoomLabel }}</span
      >
    </div>
    <p class="mt-1 text-xs text-slate-400">
      100% 为实际像素查看；放大查看时可拖动图片检查局部细节。
    </p>
  </div>
</template>
