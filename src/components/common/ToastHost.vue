<script setup lang="ts">
import { useToast } from '../../composables/useToast'

const { state, dismiss } = useToast()

const kindCls: Record<string, string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed top-4 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="t in state.items"
          :key="t.id"
          class="pointer-events-auto flex cursor-pointer items-start justify-between rounded-lg border px-3 py-2 text-sm shadow-sm"
          :class="kindCls[t.kind]"
          @click="dismiss(t.id)"
        >
          <span>{{ t.text }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
