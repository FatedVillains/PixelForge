<script setup lang="ts">
defineProps<{
  modelValue: number | null
  placeholder?: string
  min?: number
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  if (raw === '') {
    emit('update:modelValue', null)
    return
  }
  const n = Number(raw)
  emit('update:modelValue', Number.isFinite(n) ? n : null)
}
</script>

<template>
  <input
    type="number"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :min="min"
    :disabled="disabled"
    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
    @input="onInput"
  />
</template>
