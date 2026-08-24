<script setup lang="ts">
import { computed } from 'vue'
import { useImagesStore } from '../../stores/images'
import BaseButton from '../ui/BaseButton.vue'

defineEmits<{ 'download-zip': []; close: [] }>()

const images = useImagesStore()

const percent = computed(() =>
  images.batch.total > 0 ? Math.round((images.batch.done / images.batch.total) * 100) : 0,
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="images.batch.active || images.batch.finished"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
    >
      <div class="w-[min(92vw,460px)] rounded-2xl bg-white p-6 shadow-xl">
        <template v-if="images.batch.active">
          <h3 class="text-base font-semibold">正在处理…</h3>
          <p class="mt-1 truncate text-sm text-slate-500">{{ images.batch.currentName }}</p>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-brand-600 transition-all duration-200"
              :style="{ width: percent + '%' }"
            />
          </div>
          <p class="mt-2 text-right text-sm text-slate-400">
            {{ images.batch.done }} / {{ images.batch.total }}
          </p>
        </template>

        <template v-else>
          <h3 class="text-base font-semibold">处理完成</h3>
          <p class="mt-2 text-sm">
            <span class="font-medium text-emerald-600">成功 {{ images.batch.successCount }}</span>
            <span class="mx-2 text-slate-300">|</span>
            <span :class="images.batch.failedCount ? 'font-medium text-red-500' : 'text-slate-400'">
              失败 {{ images.batch.failedCount }}
            </span>
          </p>
          <p v-if="images.batch.failedCount" class="mt-1 text-xs text-slate-400">
            失败原因见左侧列表中标红条目。
          </p>
          <div class="mt-5 flex justify-end gap-2">
            <BaseButton variant="ghost" @click="$emit('close')">关闭</BaseButton>
            <BaseButton :disabled="images.batch.successCount === 0" @click="$emit('download-zip')">
              下载 ZIP
            </BaseButton>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
