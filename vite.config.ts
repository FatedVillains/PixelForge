/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // iife：内联 Worker（?worker&inline）以 blob 加载，经典脚本兼容性最好
  worker: { format: 'iife' },
  test: {
    environment: 'node',
    globals: false,
  },
})
