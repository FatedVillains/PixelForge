<script setup lang="ts">
defineProps<{ modelValue: boolean; label?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <label
    class="flex cursor-pointer items-center gap-2 select-none"
    :class="{ 'pointer-events-none opacity-50': disabled }"
  >
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      class="relative h-5 w-9 rounded-full transition-colors"
      :class="modelValue ? 'bg-brand-600' : 'bg-slate-300'"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
        :class="{ 'translate-x-4': modelValue }"
      />
    </button>
    <span v-if="label" class="text-sm text-slate-700">{{ label }}</span>
  </label>
</template>
