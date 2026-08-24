<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import HomeView from './views/HomeView.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import ToastHost from './components/common/ToastHost.vue'
import { useToast } from './composables/useToast'

const view = ref<'home' | 'workspace'>('home')

// 全局兜底：任何未捕获异常转为用户可见提示，页面不崩溃
const { push } = useToast()
function onUnhandled(e: PromiseRejectionEvent) {
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason)
  push('error', `发生未预期的错误：${reason}`)
}
onMounted(() => window.addEventListener('unhandledrejection', onUnhandled))
onUnmounted(() => window.removeEventListener('unhandledrejection', onUnhandled))
</script>

<template>
  <HomeView v-if="view === 'home'" @start="view = 'workspace'" />
  <WorkspaceView v-else @back-home="view = 'home'" />
  <ToastHost />
</template>
