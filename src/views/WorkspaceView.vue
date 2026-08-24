<template>
  <div class="p-6">
    <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" @click="$emit('backHome')">
      ← 返回首页
    </button>
    <p class="mt-4 text-sm text-slate-500">工作台（建设中）</p>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ backHome: [] }>()
</script>
