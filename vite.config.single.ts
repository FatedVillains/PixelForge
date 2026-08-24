/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/** 完全离线单文件构建：所有 JS/CSS/Worker 内联进一个 index.html（输出 dist-single/） */
export default defineConfig({
  plugins: [vue(), tailwindcss(), viteSingleFile()],
  worker: { format: 'iife' },
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
  },
})
