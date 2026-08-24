<script setup lang="ts">
defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative z-10 w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="mb-2 text-base font-semibold text-slate-900">{{ title }}</h3>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
