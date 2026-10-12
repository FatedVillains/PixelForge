<script setup lang="ts">
import AppDialog from '../ui/AppDialog.vue'
import BaseButton from '../ui/BaseButton.vue'

defineProps<{
  open: boolean
  title?: string
  reason: string
  hint?: string
  confirmText?: string
  cancelText?: string
}>()
const emit = defineEmits<{ settle: [ok: boolean] }>()
</script>

<template>
  <AppDialog :open="open" :title="title ?? '需要确认'" @close="emit('settle', false)">
    <p class="text-sm text-slate-600">{{ reason }}</p>
    <p v-if="hint" class="mt-1 text-sm text-slate-500">{{ hint }}</p>
    <div class="mt-5 flex justify-end gap-2">
      <BaseButton variant="ghost" @click="emit('settle', false)">{{ cancelText ?? '取消' }}</BaseButton>
      <BaseButton @click="emit('settle', true)">{{ confirmText ?? '继续' }}</BaseButton>
    </div>
  </AppDialog>
</template>
