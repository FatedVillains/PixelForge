<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }>(),
  { variant: 'primary', disabled: false },
)
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800': variant === 'primary',
      'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100': variant === 'ghost',
      'bg-red-50 text-red-600 hover:bg-red-100': variant === 'danger',
    }"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
