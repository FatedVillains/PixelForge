<script setup lang="ts">
import { ref } from 'vue'
import { ACCEPTED_INPUT_TYPES } from '../../core/sniff'

const emit = defineEmits<{ files: [File[]] }>()
const dragging = ref(false)
const inputRef = ref<HTMLInputElement>()

function pickFiles() {
  inputRef.value?.click()
}

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  emitFiles(input.files)
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  emitFiles(e.dataTransfer?.files)
}

function emitFiles(list: FileList | null | undefined) {
  if (!list || list.length === 0) return
  emit('files', Array.from(list))
}
</script>

<template>
  <div
    class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors"
    :class="
      dragging
        ? 'border-brand-500 bg-brand-50'
        : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40'
    "
    @click="pickFiles"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
      🖼️
    </div>
    <p class="text-base font-medium text-slate-700">拖拽图片到这里，或点击选择图片</p>
    <p class="text-sm text-slate-400">也可以直接 Ctrl + V 粘贴截图</p>
    <input
      ref="inputRef"
      type="file"
      multiple
      :accept="ACCEPTED_INPUT_TYPES"
      class="hidden"
      @change="onInputChange"
    />
  </div>
</template>
