<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import HomeView from './views/HomeView.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import UpscaleView from './views/UpscaleView.vue'
import ToastHost from './components/common/ToastHost.vue'
import { useToast } from './composables/useToast'

const view = ref<'home' | 'workspace' | 'upscale'>('home')

// 全局兜底：任何未捕获异常转为用户可见提示，页面不崩溃
const { push } = useToast()
function onUnhandled(e: PromiseRejectionEvent) {
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason)
  push('error', `发生未预期的错误：${reason}`)
}
function onWindowError(e: ErrorEvent) {
  /* 资源加载失败（<img> 解码错误等）不弹提示，只处理真正的脚本异常 */
  if (e.target && e.target !== window) return
  push('error', `脚本错误：${e.message}`)
}
onMounted(() => window.addEventListener('unhandledrejection', onUnhandled))
onUnmounted(() => window.removeEventListener('unhandledrejection', onUnhandled))
onMounted(() => window.addEventListener('error', onWindowError))
onUnmounted(() => window.removeEventListener('error', onWindowError))
</script>

<template>
  <HomeView v-if="view === 'home'" @start="view = 'workspace'" @start-upscale="view = 'upscale'" />
  <UpscaleView v-else-if="view === 'upscale'" @back-home="view = 'home'" />
  <WorkspaceView v-else @back-home="view = 'home'" />
  <ToastHost />
</template>
