<script setup lang="ts">
const props = withDefaults(
  defineProps<{ modelValue: number; min?: number; max?: number; step?: number }>(),
  { min: 1, max: 100, step: 1 },
)
const emit = defineEmits<{ 'update:modelValue': [number] }>()

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <input
    type="range"
    :value="props.modelValue"
    :min="min"
    :max="max"
    :step="step"
    class="w-full accent-brand-600"
    @input="onInput"
  />
</template>
