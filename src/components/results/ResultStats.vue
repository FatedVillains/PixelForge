<script setup lang="ts">
import { computed } from 'vue'
import type { ImageAsset } from '../../core/types'
import { compressionRatio, formatBytes } from '../../utils/format'

const props = defineProps<{ asset: ImageAsset }>()

const saved = computed(() =>
  props.asset.result ? Math.max(0, props.asset.bytes - props.asset.result.bytes) : 0,
)
const ratio = computed(() =>
  props.asset.result ? compressionRatio(props.asset.bytes, props.asset.result.bytes) : 0,
)
const formatLabel = computed(() => props.asset.result?.format.toUpperCase() ?? '')
</script>

<template>
  <div
    v-if="asset.result"
    class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm"
  >
    <div>
      <p class="text-xs text-slate-400">原始</p>
      <p class="font-semibold text-slate-800">{{ formatBytes(asset.bytes) }}</p>
      <p class="text-xs text-slate-400">{{ asset.width }}×{{ asset.height }}</p>
    </div>
    <div class="flex flex-col items-center">
      <span class="text-lg text-brand-600">↓</span>
      <span class="text-xs font-semibold text-emerald-600">-{{ ratio }}%</span>
      <span class="text-xs text-slate-400">省 {{ formatBytes(saved) }}</span>
    </div>
    <div class="text-right">
      <p class="text-xs text-slate-400">处理后</p>
      <p class="font-semibold text-slate-800">{{ formatBytes(asset.result.bytes) }}</p>
      <p class="text-xs text-slate-400">{{ asset.result.width }}×{{ asset.result.height }} · {{ formatLabel }}</p>
    </div>
  </div>
</template>
