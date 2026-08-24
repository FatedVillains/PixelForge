<script setup lang="ts">
defineProps<{ original: Blob; result: Blob }>()
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
    对比视图加载完成（Task 14 提供滑块对比）
  </div>
</template>
