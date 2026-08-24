<script setup lang="ts">
import type { AssetStatus, ImageAsset } from '../../core/types'
import { formatBytes } from '../../utils/format'

defineProps<{ asset: ImageAsset; active: boolean; disabled?: boolean }>()
defineEmits<{ select: []; remove: [] }>()

const statusMeta: Record<AssetStatus, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'bg-slate-100 text-slate-500' },
  processing: { label: '处理中', cls: 'bg-blue-50 text-blue-600' },
  done: { label: '已完成', cls: 'bg-emerald-50 text-emerald-600' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-600' },
}
</script>

<template>
  <div
    class="group relative flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors"
    :class="active ? 'border-brand-500 bg-brand-50/60' : 'border-transparent hover:bg-slate-100'"
    @click="$emit('select')"
  >
    <img
      :src="asset.thumbUrl"
      alt=""
      class="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
    />
    <div class="min-w-0 flex-1">
      <p class="truncate pr-6 text-sm font-medium text-slate-800">{{ asset.name }}</p>
      <p class="mt-0.5 text-xs text-slate-400">
        {{ formatBytes(asset.bytes) }} · {{ asset.width }}×{{ asset.height }}
      </p>
      <p v-if="asset.status === 'failed'" class="mt-0.5 truncate text-xs text-red-500">
        {{ asset.error }}
      </p>
      <p v-else-if="asset.status === 'done' && asset.result" class="mt-0.5 text-xs text-emerald-600">
        {{ formatBytes(asset.result.bytes) }} · 省
        {{ formatBytes(Math.max(0, asset.bytes - asset.result.bytes)) }}
      </p>
    </div>
    <span
      class="absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[10px]"
      :class="statusMeta[asset.status].cls"
    >
      {{ statusMeta[asset.status].label }}
    </span>
    <button
      class="absolute right-2 bottom-2 hidden h-5 w-5 items-center justify-center rounded-full text-slate-400 group-hover:flex hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-50"
      :disabled="disabled"
      title="删除"
      @click.stop="$emit('remove')"
    >
      ✕
    </button>
  </div>
</template>
