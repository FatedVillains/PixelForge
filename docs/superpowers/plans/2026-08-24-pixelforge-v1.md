# 像素匠 PixelForge v1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建纯本地的图片压缩与处理工具 v1（仅 P0）：上传/拖拽/粘贴 → 压缩（质量/目标大小）→ 尺寸与像素调整 → 格式转换 → 对比预览 → 批量处理与 ZIP 导出。

**Architecture:** 处理核心为平台无关纯 TS（`src/core`），运行于 Web Worker 池（OffscreenCanvas 解码/缩放/编码），主线程只做 UI 与调度；Vue 3 + Pinia 状态管理；核心逻辑与 UI 彻底解耦，未来 Tauri/Capacitor 复用同一核心。

**Tech Stack:** Vue 3 · TypeScript · Vite 6 · Tailwind CSS v4 · Pinia · fflate · Vitest

**Spec:** `docs/superpowers/specs/2026-08-24-pixelforge-v1-design.md`

## Global Constraints

- 包管理器一律 `pnpm`（Node ≥ 20）
- 运行时依赖仅允许：`vue`、`pinia`、`fflate`、`tailwindcss`
- 界面文案为简体中文；产品级文案集中在 `src/content.ts`
- 全应用不得发起任何携带图片数据的网络请求（隐私硬约束）
- 图片处理必须运行在 Web Worker；环境不支持时回退主线程执行同一条管线
- 解码必须使用 `createImageBitmap(blob, { imageOrientation: 'from-image' })` 保证 EXIF 方向正确
- 目标大小模式仅对 JPEG/WEBP 生效；PNG + 目标大小组合在 UI 禁用并在管线层报错兜底
- 大图保护阈值：像素 > 40,000,000 或文件 > 50MB 时必须弹确认框
- 每个任务结束必须通过 `pnpm typecheck` 与 `pnpm test`（UI 任务加 `pnpm build`），然后 git commit
- 提交信息前缀：`feat:` / `test:` / `chore:` / `docs:`

---

### Task 1: 项目脚手架（Vite + Vue3 + TS + Tailwind v4 + Pinia + Vitest）

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `public/favicon.svg`
- Create: `src/main.ts`, `src/App.vue`, `src/vite-env.d.ts`, `src/styles/main.css`, `src/content.ts`
- Test: `tests/app.spec.ts`

**Interfaces:**
- Produces: 可运行的空应用；`src/content.ts` 导出 `BRAND` 常量

- [ ] **Step 1: 写入配置与骨架文件**

`package.json`：

```json
{
  "name": "pixelforge",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "fflate": "^0.8.2",
    "pinia": "^2.2.6",
    "vue": "^3.5.13"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@vitejs/plugin-vue": "^5.2.1",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^15.11.7",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.6.3",
    "vite": "^6.0.3",
    "vitest": "^2.1.8",
    "vue-tsc": "^2.1.10"
  }
}
```

`vite.config.ts`：

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    globals: false,
  },
})
```

需要 DOM 的测试文件顶部加注释 `// @vitest-environment happy-dom`。

`tsconfig.json`：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "jsx": "preserve",
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "types": ["vite/client"],
    "useDefineForClassFields": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>像素匠 PixelForge — 本地图片压缩与处理</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`.gitignore`：

```
node_modules/
dist/
*.local
```

`public/favicon.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6a3fe8"/><circle cx="26" cy="26" r="9" fill="#fff" opacity=".9"/><rect x="34" y="34" width="12" height="12" rx="3" fill="#fff" opacity=".7"/></svg>
```

`src/main.ts`：

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'

createApp(App).use(createPinia()).mount('#app')
```

`src/vite-env.d.ts`：

```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
```

`src/styles/main.css`：

```css
@import "tailwindcss";

@theme {
  --color-brand-50: #f3f2ff;
  --color-brand-100: #e9e7ff;
  --color-brand-200: #d5d1ff;
  --color-brand-300: #b7b0ff;
  --color-brand-400: #9585fb;
  --color-brand-500: #7a5ff5;
  --color-brand-600: #6a3fe8;
  --color-brand-700: #5a30cd;
  --color-brand-800: #4a2aa5;
  --color-brand-900: #3f2a82;
}

body {
  @apply bg-slate-50 text-slate-900 antialiased;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}
```

`src/content.ts`：

```ts
export const BRAND = {
  name: '像素匠 PixelForge',
  shortName: 'PixelForge',
  subtitle: '图片压缩 · 尺寸调整 · 像素修改 · 清晰度优化',
  heroTitle: '图片压缩与处理工具',
  heroSub: '简单、快速、安全、本地处理',
  slogan: '让每一张图片，都刚刚好。',
  privacyNote: '🔒 图片默认在您的设备本地处理，不上传服务器',
  formatsLine: '支持 JPG / JPEG · PNG · WEBP · BMP',
  about: {
    title: '关于 像素匠 PixelForge',
    body: '本地图片压缩与处理工具。所有处理均在您的浏览器中完成，图片不会上传到任何服务器。',
  },
} as const
```

`src/App.vue`（占位版，Task 10 替换）：

```vue
<template>
  <div class="p-8 text-lg font-bold">像素匠 PixelForge</div>
</template>
```

`tests/app.spec.ts`：

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'

describe('App bootstrap', () => {
  it('renders brand name', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('PixelForge')
  })
})
```

- [ ] **Step 2: 安装依赖**

Run: `pnpm install`
Expected: 安装成功，无 peer 冲突报错

- [ ] **Step 3: 运行测试确认通过**

Run: `pnpm test`
Expected: `1 passed`

- [ ] **Step 4: 构建 + 类型检查**

Run: `pnpm build`
Expected: vue-tsc 无错误，产出 `dist/`

- [ ] **Step 5: 开发服务器人工验证**

Run: `pnpm dev`，浏览器打开输出地址。
Expected: 显示「像素匠 PixelForge」，控制台无报错。验证后关闭。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vue3+TS+Vite+Tailwind4+Pinia+Vitest project"
```

---

### Task 2: 核心类型 + 文件魔数嗅探

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/sniff.ts`
- Test: `tests/core/sniff.spec.ts`

**Interfaces:**
- Produces（后续所有任务依赖）:

```ts
export type OutputFormat = 'jpeg' | 'png' | 'webp'
export type InputFormat = OutputFormat | 'bmp' | 'unknown'
export type CompressMode = 'quality' | 'targetSize'

export interface ResizeOptions {
  width: number
  height: number
  keepAspectRatio: boolean
}

export interface ProcessOptions {
  outputFormat: OutputFormat
  mode: CompressMode
  quality?: number
  targetSizeBytes?: number
  resize?: ResizeOptions
}

export interface ProcessResult {
  blob: Blob
  width: number
  height: number
  bytes: number
  format: OutputFormat
  iterations: number
  fitsTarget: boolean
}

export type AssetStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface ImageAsset {
  id: string
  name: string
  bytes: number
  format: InputFormat
  width: number
  height: number
  file: Blob
  thumbUrl?: string
  status: AssetStatus
  error?: string
  result?: ProcessResult
  resultUrl?: string
}

export type ProcessErrorCode =
  | 'decode'
  | 'encode'
  | 'memory'
  | 'target-unreachable'
  | 'unknown'

export interface ProcessJobInput {
  jobId: string
  blob: Blob
  options: ProcessOptions
}

export type WorkerRequest = { type: 'process'; job: ProcessJobInput }

export type WorkerResponse =
  | { type: 'progress'; jobId: string; stage: string }
  | { type: 'done'; jobId: string; result: ProcessResult }
  | { type: 'error'; jobId: string; code: ProcessErrorCode; message: string }
```

以及 `sniffFormat(bytes: Uint8Array): InputFormat`、`sniffFile(file: Blob): Promise<InputFormat>`、`const ACCEPTED_INPUT_TYPES: string`。

- [ ] **Step 1: 写失败测试**

`tests/core/sniff.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { sniffFormat } from '../../src/core/sniff'

const jpegHead = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]
const pngHead = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const webpHead = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
const bmpHead = [0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const riffOnly = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]

describe('sniffFormat', () => {
  it('detects jpeg', () => {
    expect(sniffFormat(new Uint8Array(jpegHead))).toBe('jpeg')
  })
  it('detects png', () => {
    expect(sniffFormat(new Uint8Array(pngHead))).toBe('png')
  })
  it('detects webp', () => {
    expect(sniffFormat(new Uint8Array(webpHead))).toBe('webp')
  })
  it('detects bmp', () => {
    expect(sniffFormat(new Uint8Array(bmpHead))).toBe('bmp')
  })
  it('rejects riff without WEBP tag', () => {
    expect(sniffFormat(new Uint8Array(riffOnly))).toBe('unknown')
  })
  it('rejects short buffers', () => {
    expect(sniffFormat(new Uint8Array([0xff, 0xd8]))).toBe('unknown')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test -- tests/core/sniff.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

创建 `src/core/types.ts`：写入上面 Interfaces 中的完整类型定义。

创建 `src/core/sniff.ts`：

```ts
import type { InputFormat } from './types'

const startsWith = (b: Uint8Array, sig: number[], offset = 0): boolean =>
  sig.every((byte, i) => b[offset + i] === byte)

export function sniffFormat(bytes: Uint8Array): InputFormat {
  if (bytes.length < 12) return 'unknown'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'png'
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'webp'
  if (startsWith(bytes, [0x42, 0x4d])) return 'bmp'
  return 'unknown'
}

export async function sniffFile(file: Blob): Promise<InputFormat> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  return sniffFormat(head)
}

export const ACCEPTED_INPUT_TYPES =
  '.jpg,.jpeg,.png,.webp,.bmp,image/jpeg,image/png,image/webp,image/bmp'
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/core tests
git commit -m "feat(core): shared types and magic-number format sniffing"
```

---

### Task 3: 纯函数工具集（格式化 / 命名 / 几何换算 / 大图守卫）

**Files:**
- Create: `src/utils/format.ts`, `src/utils/naming.ts`, `src/core/guard.ts`, `src/core/processors/resize.ts`
- Test: `tests/utils/format.spec.ts`, `tests/utils/naming.spec.ts`, `tests/core/guard.spec.ts`, `tests/core/geometry.spec.ts`

**Interfaces:**
- Consumes: `InputFormat`（Task 2）
- Produces:
  - `formatBytes(bytes: number): string`
  - `compressionRatio(before: number, after: number): number`（百分比，保留 1 位小数，负值截为 0）
  - `splitFileName(name: string): { base: string; ext: string }`
  - `buildOutputName(originalName: string, opts: { ext: string; suffixKind: 'none' | 'compressed' | 'dimensions'; width?: number; height?: number }): string`
  - `uniqueName(name: string, taken: Set<string>): string`
  - `GUARD_MAX_PIXELS = 40_000_000`, `GUARD_MAX_BYTES = 50 * 1024 * 1024`
  - `checkBytesGuard(bytes: number): { oversized: boolean; reason?: string }`
  - `checkPixelsGuard(width: number, height: number): { oversized: boolean; reason?: string }`
  - `interface Dimensions { width: number; height: number }`
  - `computeTargetDimensions(original: Dimensions, target: ResizeOptions | undefined): Dimensions`（锁定比例时以宽度为准）
  - `stepDownPlan(fromW, fromH, toW, toH): Dimensions[]`（多步降采样计划，末项必为目标尺寸）

注意：`computeTargetDimensions` 与 `stepDownPlan` 放在 `resize.ts`（纯数学），Canvas 绘制执行在 Task 5 的 `codec.ts`。

- [ ] **Step 1: 写失败测试**

`tests/utils/format.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { compressionRatio, formatBytes } from '../../src/utils/format'

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })
  it('formats KB', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
  it('formats small KB with two decimals', () => {
    expect(formatBytes(1536)).toBe('1.50 KB')
  })
  it('formats MB', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB')
  })
  it('handles invalid input', () => {
    expect(formatBytes(-1)).toBe('-')
    expect(formatBytes(NaN)).toBe('-')
  })
})

describe('compressionRatio', () => {
  it('computes percentage saved', () => {
    expect(compressionRatio(4820000, 486 * 1024)).toBeGreaterThan(80)
  })
  it('returns 0 when nothing saved', () => {
    expect(compressionRatio(100, 100)).toBe(0)
  })
  it('clamps negative to 0', () => {
    expect(compressionRatio(100, 200)).toBe(0)
  })
})
```

`tests/utils/naming.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { buildOutputName, splitFileName, uniqueName } from '../../src/utils/naming'

describe('splitFileName', () => {
  it('splits base and ext', () => {
    expect(splitFileName('photo.JPG')).toEqual({ base: 'photo', ext: 'jpg' })
  })
  it('handles multiple dots', () => {
    expect(splitFileName('my.photo.png')).toEqual({ base: 'my.photo', ext: 'png' })
  })
  it('handles no ext', () => {
    expect(splitFileName('photo')).toEqual({ base: 'photo', ext: '' })
  })
})

describe('buildOutputName', () => {
  it('appends _compressed', () => {
    expect(
      buildOutputName('test.jpg', { ext: 'jpeg', suffixKind: 'compressed' }),
    ).toBe('test_compressed.jpeg')
  })
  it('appends dimensions suffix', () => {
    expect(
      buildOutputName('test.jpg', {
        ext: 'jpg',
        suffixKind: 'dimensions',
        width: 1920,
        height: 1080,
      }),
    ).toBe('test_1920x1080.jpg')
  })
  it('no suffix keeps base', () => {
    expect(buildOutputName('test.jpg', { ext: 'webp', suffixKind: 'none' })).toBe(
      'test.webp',
    )
  })
  it('ignores dimensions when kind is compressed', () => {
    expect(
      buildOutputName('a.png', {
        ext: 'png',
        suffixKind: 'compressed',
        width: 10,
        height: 10,
      }),
    ).toBe('a_compressed.png')
  })
})

describe('uniqueName', () => {
  it('returns name when free', () => {
    expect(uniqueName('a.jpg', new Set())).toBe('a.jpg')
  })
  it('appends sequence on collision', () => {
    const taken = new Set(['a.jpg', 'a(1).jpg'])
    expect(uniqueName('a.jpg', taken)).toBe('a(2).jpg')
  })
})
```

`tests/core/guard.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import {
  GUARD_MAX_BYTES,
  GUARD_MAX_PIXELS,
  checkBytesGuard,
  checkPixelsGuard,
} from '../../src/core/guard'

describe('checkBytesGuard', () => {
  it('passes under limit', () => {
    expect(checkBytesGuard(GUARD_MAX_BYTES).oversized).toBe(false)
  })
  it('flags over limit with reason', () => {
    const r = checkBytesGuard(GUARD_MAX_BYTES + 1)
    expect(r.oversized).toBe(true)
    expect(r.reason).toBeTruthy()
  })
})

describe('checkPixelsGuard', () => {
  it('passes under limit', () => {
    const r = checkPixelsGuard(8000, 5000)
    expect(r.oversized).toBe(false)
  })
  it('flags over limit with reason', () => {
    const r = checkPixelsGuard(12000, 9000)
    expect(r.oversized).toBe(true)
    expect(r.reason).toContain('12000×9000')
  })
  it('exposes threshold constant', () => {
    expect(GUARD_MAX_PIXELS).toBe(40_000_000)
  })
})
```

`tests/core/geometry.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import {
  computeTargetDimensions,
  stepDownPlan,
} from '../../src/core/processors/resize'

const orig = { width: 4032, height: 3024 }

describe('computeTargetDimensions', () => {
  it('returns original when no target', () => {
    expect(computeTargetDimensions(orig, undefined)).toEqual(orig)
  })
  it('locks aspect by width', () => {
    expect(
      computeTargetDimensions(orig, { width: 1920, height: 0, keepAspectRatio: true }),
    ).toEqual({ width: 1920, height: 1440 })
  })
  it('locks aspect by width even if both given', () => {
    expect(
      computeTargetDimensions(orig, { width: 1280, height: 999, keepAspectRatio: true }),
    ).toEqual({ width: 1280, height: 960 })
  })
  it('derives width from height when width missing', () => {
    expect(
      computeTargetDimensions(orig, { width: 0, height: 1512, keepAspectRatio: true }),
    ).toEqual({ width: 2016, height: 1512 })
  })
  it('free stretch when unlocked', () => {
    expect(
      computeTargetDimensions(orig, { width: 295, height: 413, keepAspectRatio: false }),
    ).toEqual({ width: 295, height: 413 })
  })
  it('exact id photo pixels', () => {
    expect(
      computeTargetDimensions({ width: 6000, height: 4000 }, {
        width: 295,
        height: 413,
        keepAspectRatio: false,
      }),
    ).toEqual({ width: 295, height: 413 })
  })
  it('clamps to min 1px', () => {
    expect(
      computeTargetDimensions(orig, { width: 0, height: 1, keepAspectRatio: true }).height,
    ).toBeGreaterThanOrEqual(1)
  })
})

describe('stepDownPlan', () => {
  it('single step for mild shrink', () => {
    expect(stepDownPlan(2000, 1500, 1920, 1440)).toEqual([
      { width: 1920, height: 1440 },
    ])
  })
  it('multi steps end at target', () => {
    const plan = stepDownPlan(8000, 6000, 800, 600)
    expect(plan[plan.length - 1]).toEqual({ width: 800, height: 600 })
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]!.width).toBeLessThan(plan[i - 1]!.width!)
    }
  })
  it('single step for upscale', () => {
    expect(stepDownPlan(640, 480, 1280, 960)).toEqual([
      { width: 1280, height: 960 },
    ])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test -- tests/utils tests/core/guard.spec.ts tests/core/geometry.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`src/utils/format.ts`：

```ts
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 2 : 1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

export function compressionRatio(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.max(0, Math.round((1 - after / before) * 1000) / 10)
}
```

`src/utils/naming.ts`：

```ts
export function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() }
}

export function buildOutputName(
  originalName: string,
  opts: {
    ext: string
    suffixKind: 'none' | 'compressed' | 'dimensions'
    width?: number
    height?: number
  },
): string {
  const { base } = splitFileName(originalName)
  const ext = opts.ext.replace(/^\./, '').toLowerCase()
  let suffix = ''
  if (opts.suffixKind === 'compressed') suffix = '_compressed'
  if (opts.suffixKind === 'dimensions' && opts.width && opts.height)
    suffix = `_${opts.width}x${opts.height}`
  return `${base}${suffix}.${ext}`
}

export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name
  const { base, ext } = splitFileName(name)
  for (let i = 1; i < 10000; i++) {
    const candidate = `${base}(${i}).${ext}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}_${Date.now()}.${ext}`
}
```

`src/core/guard.ts`：

```ts
export const GUARD_MAX_PIXELS = 40_000_000
export const GUARD_MAX_BYTES = 50 * 1024 * 1024

export interface GuardResult {
  oversized: boolean
  reason?: string
}

export function checkBytesGuard(bytes: number): GuardResult {
  if (bytes > GUARD_MAX_BYTES) {
    return {
      oversized: true,
      reason: `文件大小 ${Math.round(bytes / 1048576)}MB 超过 50MB`,
    }
  }
  return { oversized: false }
}

export function checkPixelsGuard(width: number, height: number): GuardResult {
  const pixels = width * height
  if (pixels > GUARD_MAX_PIXELS) {
    return {
      oversized: true,
      reason: `图片尺寸 ${width}×${height} 超过 4000 万像素`,
    }
  }
  return { oversized: false }
}
```

`src/core/processors/resize.ts`：

```ts
import type { ResizeOptions } from '../types'

export interface Dimensions {
  width: number
  height: number
}

export function computeTargetDimensions(
  original: Dimensions,
  target: ResizeOptions | undefined,
): Dimensions {
  if (!target || (!target.width && !target.height)) return { ...original }
  let width = Math.round(target.width ?? 0)
  let height = Math.round(target.height ?? 0)
  if (target.keepAspectRatio) {
    const ratio = original.height / original.width
    if (width > 0) {
      height = Math.round(width * ratio)
    } else if (height > 0) {
      width = Math.round(height / ratio)
    }
  }
  width = Math.min(Math.max(width || original.width, 1), 20000)
  height = Math.min(Math.max(height || original.height, 1), 20000)
  return { width, height }
}

export function stepDownPlan(fromW: number, fromH: number, toW: number, toH: number): Dimensions[] {
  const plan: Dimensions[] = []
  let w = fromW
  let h = fromH
  while (w > toW * 2 && h > toH * 2) {
    w = Math.max(toW, Math.round(w / 2))
    h = Math.max(toH, Math.round(h / 2))
    plan.push({ width: w, height: h })
  }
  const last = plan[plan.length - 1]
  if (!last || last.width !== toW || last.height !== toH) {
    plan.push({ width: toW, height: toH })
  }
  return plan
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test && pnpm typecheck`
Expected: 全部 PASS，类型无错

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): pure helpers for formatting, naming, geometry, guards"
```

---

### Task 4: 目标大小二分求解器（核心算法）

**Files:**
- Create: `src/core/processors/target-size.ts`
- Test: `tests/core/target-size.spec.ts`

**Interfaces:**
- Consumes: 无（纯逻辑）
- Produces:

```ts
/** 探针：按指定质量与尺寸缩放编码一次，返回编码后字节数（由 pipeline 注入真实编码） */
export type EncodeProbe = (quality: number, scale: number) => Promise<number>

export interface TargetSolveOptions {
  minScale?: number   // 默认 0.1，尺寸回退下限
  maxEncodes?: number // 默认 48，总编码预算
}

export interface TargetSolveResult {
  quality: number      // 选中的 JPEG/WebP 质量 1–100
  scale: number        // 尺寸缩放系数（1 = 原目标尺寸）
  fitsTarget: boolean  // 是否达到 ≤ 目标大小
  encodes: number      // 实际编码次数
}

export async function solveTargetSize(
  targetBytes: number,
  probe: EncodeProbe,
  opts?: TargetSolveOptions,
): Promise<TargetSolveResult>
```

语义：在当前 scale 下对 quality ∈ [1,100] 二分，找「size(q) ≤ target 的最大 q」；若 q=1 仍超标则 scale ×0.85 重试；返回结果保证 `probe(quality, scale) ≤ targetBytes`（fitsTarget=true 时）。同一 (q,scale) 组合的结果会被缓存，不重复编码。

- [ ] **Step 1: 写失败测试**

`tests/core/target-size.spec.ts`：

```ts
import { describe, it, expect, vi } from 'vitest'
import { solveTargetSize } from '../../src/core/processors/target-size'

/** 确定性模型：size(q, s) = q * 1000 * s² */
const linearProbe = vi.fn(
  (q: number, s: number) => Promise.resolve(Math.round(q * 1000 * s * s)),
)

describe('solveTargetSize', () => {
  it('returns max quality when generous target', async () => {
    const r = await solveTargetSize(512 * 1024, linearProbe)
    expect(r.fitsTarget).toBe(true)
    expect(r.quality).toBe(100)
    expect(r.scale).toBe(1)
  })

  it('finds exact boundary quality', async () => {
    const probe = (q: number, s: number) =>
      Promise.resolve(Math.round(q * 1000 * s * s))
    const r = await solveTargetSize(50_000, probe)
    expect(r).toMatchObject({ fitsTarget: true, quality: 50, scale: 1 })
    expect(r.encodes).toBeLessThanOrEqual(8)
  })

  it('falls back to smaller scale when unreachable', async () => {
    const probe = (q: number, s: number) =>
      Promise.resolve(Math.round(q * 1000 * s * s))
    const r = await solveTargetSize(500, probe)
    expect(r.fitsTarget).toBe(true)
    expect(r.scale).toBeLessThan(1)
    const finalSize = await probe(r.quality, r.scale)
    expect(finalSize).toBeLessThanOrEqual(500)
  })

  it('respects encode budget and reports best effort', async () => {
    const huge = () => Promise.resolve(Number.MAX_SAFE_INTEGER)
    const r = await solveTargetSize(100, huge, { maxEncodes: 5 })
    expect(r.fitsTarget).toBe(false)
    expect(r.quality).toBe(1)
  })

  it('caches duplicate probes', async () => {
    const spy = vi.fn((q: number, _s: number) => Promise.resolve(q * 100))
    await solveTargetSize(50_000, spy)
    const calls = spy.mock.calls.map((c) => `${c[0]}@${c[1]}`)
    expect(new Set(calls).size).toBe(calls.length)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test -- tests/core/target-size.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`src/core/processors/target-size.ts`：

```ts
export type EncodeProbe = (quality: number, scale: number) => Promise<number>

export interface TargetSolveOptions {
  minScale?: number
  maxEncodes?: number
}

export interface TargetSolveResult {
  quality: number
  scale: number
  fitsTarget: boolean
  encodes: number
}

export async function solveTargetSize(
  targetBytes: number,
  probe: EncodeProbe,
  opts: TargetSolveOptions = {},
): Promise<TargetSolveResult> {
  const minScale = opts.minScale ?? 0.1
  const maxEncodes = opts.maxEncodes ?? 48

  const cache = new Map<string, number>()
  let encodes = 0

  const cachedProbe = async (q: number, s: number): Promise<number> => {
    const key = `${q}@${s.toFixed(3)}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    if (encodes >= maxEncodes) throw new Error('encode-budget-exhausted')
    encodes += 1
    const size = await probe(q, s)
    cache.set(key, size)
    return size
  }

  /** 当前 scale 下最大满足 size<=target 的质量；无则 null */
  const searchQuality = async (scale: number): Promise<number | null> => {
    const smallest = await cachedProbe(1, scale)
    if (smallest > targetBytes) return null
    let lo = 1
    let hi = 100
    while (lo < hi) {
      const mid = Math.ceil((lo + hi + 1) / 2)
      const size = await cachedProbe(mid, scale)
      if (size <= targetBytes) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  let scale = 1
  let bestEffort: TargetSolveResult | null = null

  for (;;) {
    try {
      const q = await searchQuality(scale)
      if (q !== null) {
        return { quality: q, scale, fitsTarget: true, encodes }
      }
      bestEffort = { quality: 1, scale, fitsTarget: false, encodes }
    } catch {
      break // 编码预算耗尽
    }
    scale = Number((scale * 0.85).toFixed(3))
    if (scale < minScale) break
  }

  if (!bestEffort) throw new Error('encode-budget-exhausted')
  return bestEffort
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test`
Expected: 全部 PASS（含此前任务）

- [ ] **Step 5: Commit**

```bash
git add src/core/processors/target-size.ts tests/core/target-size.spec.ts
git commit -m "feat(core): binary-search target-size solver with scale fallback"
```

---

### Task 5: 编解码层与处理管线（codec + pipeline）

**Files:**
- Create: `src/core/codec.ts`, `src/core/pipeline.ts`
- Modify: 无
- Test: 浏览器 API 层以人工验证为主（Node 无法运行 createImageBitmap）；`stepDownPlan` 已在 Task 3 覆盖

**Interfaces:**
- Consumes: `decodeImage` 用到 Task 2 类型；`computeTargetDimensions`/`stepDownPlan`（Task 3）；`solveTargetSize`（Task 4）
- Produces:
  - `const supportsOffscreen: boolean`
  - `interface DecodedImage { bitmap: ImageBitmap; width: number; height: number }`
  - `decodeImage(blob: Blob): Promise<DecodedImage>`（EXIF 方向自动转正；失败抛中文错误含「解码」）
  - `createSurface(width, height): OffscreenCanvas | HTMLCanvasElement`
  - `drawScaled(bitmap, toW, toH): SurfaceCanvas`（多步降采样，imageSmoothingQuality='high'）
  - `encodeSurface(canvas, format: OutputFormat, quality?: number): Promise<Blob>`
  - `releaseBitmap(bitmap: ImageBitmap): void`
  - `runPipeline(blob: Blob, options: ProcessOptions, onProgress?: (stage: string) => void): Promise<ProcessResult>`

- [ ] **Step 1: 实现 codec**

`src/core/codec.ts`：

```ts
import type { OutputFormat } from './types'
import { stepDownPlan } from './processors/resize'

export type SurfaceCanvas = OffscreenCanvas | HTMLCanvasElement

export const supportsOffscreen: boolean = typeof OffscreenCanvas !== 'undefined'

export interface DecodedImage {
  bitmap: ImageBitmap
  width: number
  height: number
}

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    return { bitmap, width: bitmap.width, height: bitmap.height }
  } catch (err) {
    throw new Error(`图片无法解码（${blob.type || '未知格式'}），文件可能已损坏`, {
      cause: err,
    })
  }
}

export function createSurface(width: number, height: number): SurfaceCanvas {
  if (supportsOffscreen) return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function ctxOf(canvas: SurfaceCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: false }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

export function drawScaled(bitmap: ImageBitmap, toW: number, toH: number): SurfaceCanvas {
  const plan = stepDownPlan(bitmap.width, bitmap.height, toW, toH)
  let current = createSurface(plan[0]!.width, plan[0]!.height)
  ctxOf(current).drawImage(
    bitmap as CanvasImageSource,
    0, 0, bitmap.width, bitmap.height,
    0, 0, plan[0]!.width, plan[0]!.height,
  )
  for (let i = 1; i < plan.length; i++) {
    const next = createSurface(plan[i]!.width, plan[i]!.height)
    ctxOf(next).drawImage(
      current as CanvasImageSource,
      0, 0, current.width, current.height,
      0, 0, plan[i]!.width, plan[i]!.height,
    )
    current = next
  }
  return current
}

function qualityArg(quality?: number): number | undefined {
  return quality === undefined ? undefined : Math.min(1, Math.max(0, quality / 100))
}

export async function encodeSurface(
  canvas: SurfaceCanvas,
  format: OutputFormat,
  quality?: number,
): Promise<Blob> {
  const mime = `image/${format}`
  const q = qualityArg(quality)
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: mime, quality: q })
  }
  return new Promise<Blob>((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片编码失败'))),
      mime,
      q,
    )
  })
}

export function releaseBitmap(bitmap: ImageBitmap): void {
  bitmap.close()
}
```

- [ ] **Step 2: 实现 pipeline**

`src/core/pipeline.ts`：

```ts
import { decodeImage, drawScaled, encodeSurface, releaseBitmap } from './codec'
import { computeTargetDimensions } from './processors/resize'
import { solveTargetSize } from './processors/target-size'
import type { ProcessOptions, ProcessResult } from './types'

export type ProgressReporter = (stage: string) => void

function clampQuality(q: number): number {
  return Math.min(100, Math.max(1, Math.round(q)))
}

export async function runPipeline(
  blob: Blob,
  options: ProcessOptions,
  onProgress?: ProgressReporter,
): Promise<ProcessResult> {
  onProgress?.('正在解码')
  const decoded = await decodeImage(blob)
  const { bitmap } = decoded
  try {
    const target = options.resize
      ? computeTargetDimensions({ width: bitmap.width, height: bitmap.height }, options.resize)
      : { width: bitmap.width, height: bitmap.height }

    let iterations = 1
    let quality: number | undefined =
      options.mode === 'quality' ? clampQuality(options.quality ?? 80) : undefined
    let scale = 1
    let fitsTarget = true

    if (options.mode === 'targetSize') {
      if (!options.targetSizeBytes || options.targetSizeBytes <= 0)
        throw new Error('目标大小无效')
      if (options.outputFormat === 'png')
        throw new Error('PNG 为无损格式，不支持按目标大小压缩')
      onProgress?.('正在搜索最佳质量')
      const solved = await solveTargetSize(options.targetSizeBytes, async (q, s) => {
        const w = Math.max(1, Math.round(target.width * s))
        const h = Math.max(1, Math.round(target.height * s))
        const out = await encodeSurface(drawScaled(bitmap, w, h), options.outputFormat, q)
        return out.size
      })
      quality = solved.quality
      scale = solved.scale
      fitsTarget = solved.fitsTarget
      iterations = solved.encodes + 1
    }

    onProgress?.('正在编码输出')
    const w = Math.max(1, Math.round(target.width * scale))
    const h = Math.max(1, Math.round(target.height * scale))
    const outBlob = await encodeSurface(drawScaled(bitmap, w, h), options.outputFormat, quality)

    return {
      blob: outBlob,
      width: w,
      height: h,
      bytes: outBlob.size,
      format: options.outputFormat,
      iterations,
      fitsTarget,
    }
  } finally {
    releaseBitmap(bitmap)
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__pfRunPipeline = runPipeline
}
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `pnpm typecheck && pnpm build`
Expected: 无错误

- [ ] **Step 4: 浏览器人工验证管线**

1. `pnpm dev` 打开页面
2. 准备一张本地 JPG 照片（如手机拍摄竖拍照片更佳）
3. 控制台执行（替换为你的文件）：

```js
const fileInput = document.createElement('input')
fileInput.type = 'file'
document.body.appendChild(fileInput)
// 点击该 input 选择照片后：
const blob = fileInput.files[0]
const r1 = await window.__pfRunPipeline(blob, { outputFormat: 'jpeg', mode: 'quality', quality: 80 })
console.log('质量模式:', r1.bytes, r1.width, r1.height, r1.format)
const r2 = await window.__pfRunPipeline(blob, { outputFormat: 'webp', mode: 'targetSize', targetSizeBytes: 500 * 1024 })
console.log('目标模式:', r2.bytes <= 500*1024, r2.bytes, r2.iterations, r2.fitsTarget)
```

Expected: r1 成功输出且尺寸等于原图（EXIF 方向已转正）；r2.bytes ≤ 512000。再验证像素修改：

```js
const r3 = await window.__pfRunPipeline(blob, {
  outputFormat: 'jpeg', mode: 'quality', quality: 90,
  resize: { width: 295, height: 413, keepAspectRatio: false },
})
console.log(r3.width, r3.height) // 必须严格为 295 413
```

4. Network 面板确认无任何图片上传请求
5. 关闭 dev server

- [ ] **Step 5: Commit**

```bash
git add src/core/codec.ts src/core/pipeline.ts
git commit -m "feat(core): browser codec layer and processing pipeline"
```

---

### Task 6: Worker 与调度池（process.worker + pool）

**Files:**
- Create: `src/workers/process.worker.ts`, `src/workers/pool.ts`

**Interfaces:**
- Consumes: `runPipeline`（Task 5）、`WorkerRequest/WorkerResponse/ProcessOptions/ProcessResult/ProcessErrorCode`（Task 2）
- Produces:

```ts
export interface ImageProcessor {
  process(blob: Blob, options: ProcessOptions, onStage?: (stage: string) => void): Promise<ProcessResult>
  dispose(): void
}
export class WorkerPool implements ImageProcessor
export function defaultPoolSize(): number  // min(4, max(2, cores - 1))
export function createProcessor(): ImageProcessor  // Worker 不可用时回退主线程实现
```

- [ ] **Step 1: 实现 worker 入口**

`src/workers/process.worker.ts`：

```ts
/// <reference lib="webworker" />
import { runPipeline } from '../core/pipeline'
import type { ProcessErrorCode, WorkerRequest, WorkerResponse } from '../core/types'

const post = (msg: WorkerResponse) => {
  ;(self as unknown as Worker).postMessage(msg)
}

function classifyError(err: unknown): ProcessErrorCode {
  const msg = err instanceof Error ? err.message : String(err)
  if (/解码/.test(msg)) return 'decode'
  if (/内存|allocation|MemoryError/i.test(msg)) return 'memory'
  if (/PNG|目标大小/.test(msg)) return 'target-unreachable'
  if (/编码/.test(msg)) return 'encode'
  return 'unknown'
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data
  if (!data || data.type !== 'process') return
  const { job } = data
  try {
    const result = await runPipeline(job.blob, job.options, (stage) => {
      post({ type: 'progress', jobId: job.jobId, stage })
    })
    post({ type: 'done', jobId: job.jobId, result })
  } catch (err) {
    post({
      type: 'error',
      jobId: job.jobId,
      code: classifyError(err),
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
```

- [ ] **Step 2: 实现池调度**

`src/workers/pool.ts`：

```ts
import type { ProcessOptions, ProcessResult, WorkerRequest, WorkerResponse } from '../core/types'

export interface ImageProcessor {
  process(
    blob: Blob,
    options: ProcessOptions,
    onStage?: (stage: string) => void,
  ): Promise<ProcessResult>
  dispose(): void
}

let jobSeq = 0
const nextJobId = () => `job_${Date.now().toString(36)}_${++jobSeq}`

export function defaultPoolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
  return Math.min(4, Math.max(2, cores - 1))
}

interface QueuedTask {
  blob: Blob
  options: ProcessOptions
  onStage?: (stage: string) => void
  resolve: (r: ProcessResult) => void
  reject: (e: Error) => void
}

export class WorkerPool implements ImageProcessor {
  private workers: Worker[] = []
  private idle: Worker[] = []
  private pending = new Map<Worker, QueuedTask>()
  private queue: QueuedTask[] = []
  private disposed = false

  constructor(size: number = defaultPoolSize()) {
    for (let i = 0; i < size; i++) this.workers.push(this.spawn())
  }

  private spawn(): Worker {
    const worker = new Worker(new URL('./process.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.handle(worker, e.data)
    worker.onerror = () => this.failWorker(worker, new Error('处理线程异常'))
    worker.onmessageerror = () => this.failWorker(worker, new Error('线程通信失败'))
    this.idle.push(worker)
    return worker
  }

  private settle(worker: Worker): QueuedTask | undefined {
    const task = this.pending.get(worker)
    this.pending.delete(worker)
    this.idle.push(worker)
    this.drain()
    return task
  }

  private handle(worker: Worker, msg: WorkerResponse): void {
    const task = this.pending.get(worker)
    if (!task || !msg) return
    if (msg.type === 'progress') {
      task.onStage?.(msg.stage)
      return
    }
    const settled = this.settle(worker)
    if (!settled) return
    if (msg.type === 'done') settled.resolve(msg.result)
    else settled.reject(new Error(`${msg.message}（${msg.code}）`))
  }

  private failWorker(worker: Worker, error: Error): void {
    const task = this.pending.get(worker)
    this.pending.delete(worker)
    if (task) task.reject(error)
    worker.terminate()
    this.workers = this.workers.filter((w) => w !== worker)
    this.idle = this.idle.filter((w) => w !== worker)
    try {
      this.workers.push(this.spawn())
    } catch {
      /* 环境不支持时忽略重建 */
    }
    this.drain()
  }

  process(blob: Blob, options: ProcessOptions, onStage?: (s: string) => void): Promise<ProcessResult> {
    if (this.disposed) return Promise.reject(new Error('处理器已释放'))
    return new Promise((resolve, reject) => {
      this.queue.push({ blob, options, onStage, resolve, reject })
      this.drain()
    })
  }

  private drain(): void {
    while (this.queue.length > 0 && this.idle.length > 0) {
      const worker = this.idle.pop()
      const task = this.queue.shift()
      if (!worker || !task) break
      this.pending.set(worker, task)
      const req: WorkerRequest = {
        type: 'process',
        job: { jobId: nextJobId(), blob: task.blob, options: task.options },
      }
      worker.postMessage(req)
    }
  }

  dispose(): void {
    this.disposed = true
    for (const w of this.workers) w.terminate()
    this.workers = []
    this.idle = []
    const err = new Error('处理器已释放')
    for (const [, task] of this.pending) task.reject(err)
    this.pending.clear()
    for (const t of this.queue) t.reject(err)
    this.queue = []
  }
}

class MainThreadProcessor implements ImageProcessor {
  async process(
    blob: Blob,
    options: ProcessOptions,
    onStage?: (s: string) => void,
  ): Promise<ProcessResult> {
    const { runPipeline } = await import('../core/pipeline')
    return runPipeline(blob, options, onStage)
  }
  dispose(): void {}
}

export function createProcessor(): ImageProcessor {
  if (typeof Worker === 'undefined') return new MainThreadProcessor()
  try {
    return new WorkerPool()
  } catch {
    return new MainThreadProcessor()
  }
}
```

- [ ] **Step 3: 类型检查 + 构建（确认 worker 产物生成）**

Run: `pnpm typecheck && pnpm build`
Expected: 无错误；`dist/assets` 中出现 worker chunk（文件名含 `process.worker`）

- [ ] **Step 4: Commit**

```bash
git add src/workers
git commit -m "feat(workers): process worker entry with pooled scheduler and main-thread fallback"
```

---

### Task 7: Pinia 状态层（settings + images）

**Files:**
- Create: `src/stores/settings.ts`, `src/stores/images.ts`
- Test: `tests/stores/settings.spec.ts`, `tests/stores/images.spec.ts`

**Interfaces:**
- Consumes: Task 2 类型、Task 3 `computeTargetDimensions`
- Produces:
  - `const TARGET_PRESETS: Array<{ label: string; kb: number }>`
  - `const QUICK_SIZES: Array<{ label: string; width: number; height: number }>`
  - `const ID_PHOTO_PRESETS: Array<{ label: string; width: number; height: number }>`
  - `useSettingsStore`：state `{ outputFormat, mode, quality, targetPresetKb, customTargetKb, resizeEnabled, width, height, keepAspectRatio, autoSuffix }`；action `setFormat(f)`（切 PNG 时自动把 targetSize 模式降回 quality）、`setMode(m)`
  - `buildProcessOptions(s: SettingsState-ish, original: Dimensions): ProcessOptions | null`（纯函数；目标大小缺失或 PNG+targetSize 返回 null）
  - `useImagesStore`：state `{ assets, selectedId, batch }`；actions `addAsset/remove/clearAll/setStatus/setResult/resetResults/beginBatch/advanceBatch/completeItem/finishBatch/resetBatch`；getter `selected`

- [ ] **Step 1: 写失败测试**

`tests/stores/settings.spec.ts`：

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  ID_PHOTO_PRESETS,
  QUICK_SIZES,
  buildProcessOptions,
  useSettingsStore,
} from '../../src/stores/settings'

describe('useSettingsStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('defaults to jpeg quality 80', () => {
    const s = useSettingsStore()
    expect(s.outputFormat).toBe('jpeg')
    expect(s.mode).toBe('quality')
    expect(s.quality).toBe(80)
  })

  it('switching to png downgrades targetSize mode', () => {
    const s = useSettingsStore()
    s.setMode('targetSize')
    s.setFormat('png')
    expect(s.mode).toBe('quality')
  })
})

describe('buildProcessOptions', () => {
  const base = {
    outputFormat: 'jpeg' as const,
    mode: 'quality' as const,
    quality: 80,
    targetPresetKb: 500,
    customTargetKb: null,
    resizeEnabled: false,
    width: null,
    height: null,
    keepAspectRatio: true,
    autoSuffix: true,
  }

  it('quality mode maps quality', () => {
    const o = buildProcessOptions(base, { width: 4000, height: 3000 })
    expect(o).toEqual({
      outputFormat: 'jpeg',
      mode: 'quality',
      quality: 80,
    })
  })

  it('targetSize uses preset kb converted to bytes', () => {
    const o = buildProcessOptions(
      { ...base, mode: 'targetSize', customTargetKb: null },
      { width: 100, height: 100 },
    )
    expect(o?.targetSizeBytes).toBe(500 * 1024)
  })

  it('custom target overrides preset', () => {
    const o = buildProcessOptions(
      { ...base, mode: 'targetSize', customTargetKb: 250 },
      { width: 100, height: 100 },
    )
    expect(o?.targetSizeBytes).toBe(250 * 1024)
  })

  it('returns null when target missing', () => {
    const o = buildProcessOptions(
      { ...base, mode: 'targetSize', targetPresetKb: null, customTargetKb: null },
      { width: 100, height: 100 },
    )
    expect(o).toBeNull()
  })

  it('returns null for png + targetSize', () => {
    const o = buildProcessOptions(
      { ...base, mode: 'targetSize', outputFormat: 'png' },
      { width: 100, height: 100 },
    )
    expect(o).toBeNull()
  })

  it('adds exact resize when enabled', () => {
    const o = buildProcessOptions(
      { ...base, resizeEnabled: true, width: 295, height: 413, keepAspectRatio: false },
      { width: 4032, height: 3024 },
    )
    expect(o?.resize).toEqual({ width: 295, height: 413, keepAspectRatio: false })
  })

  it('exposes presets data used by UI', () => {
    expect(TARGET_PRESETS.some((p) => p.kb === 500)).toBe(true)
    expect(QUICK_SIZES.length).toBeGreaterThanOrEqual(9)
    expect(ID_PHOTO_PRESETS.map((p) => `${p.width}x${p.height}`)).toContain('295x413')
  })
})
```

`tests/stores/images.spec.ts`：

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImagesStore } from '../../src/stores/images'

function makeAssetInput() {
  return {
    name: 'a.jpg',
    bytes: 123,
    format: 'jpeg' as const,
    width: 100,
    height: 50,
    file: new Blob(['x'], { type: 'image/jpeg' }),
  }
}

describe('useImagesStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('adds asset and selects first', () => {
    const store = useImagesStore()
    const a = store.addAsset(makeAssetInput())
    expect(store.assets).toHaveLength(1)
    expect(store.selectedId).toBe(a.id)
    expect(store.selected?.name).toBe('a.jpg')
  })

  it('remove clears selection to next asset', () => {
    const store = useImagesStore()
    const a = store.addAsset(makeAssetInput())
    const b = store.addAsset({ ...makeAssetInput(), name: 'b.jpg' })
    store.remove(a.id)
    expect(store.assets).toHaveLength(1)
    expect(store.selectedId).toBe(b.id)
  })

  it('setStatus marks failure with reason', () => {
    const store = useImagesStore()
    const a = store.addAsset(makeAssetInput())
    store.setStatus(a.id, 'failed', '图片无法解码')
    expect(store.assets[0]!.status).toBe('failed')
    expect(store.assets[0]!.error).toBe('图片无法解码')
  })

  it('batch counters track progress', () => {
    const store = useImagesStore()
    store.beginBatch(3)
    store.advanceBatch('x.jpg')
    store.completeItem(true)
    store.completeItem(false)
    expect(store.batch.done).toBe(2)
    expect(store.batch.successCount).toBe(1)
    expect(store.batch.failedCount).toBe(1)
    store.finishBatch()
    expect(store.batch.active).toBe(false)
    expect(store.batch.finished).toBe(true)
  })

  it('clearAll empties everything', () => {
    const store = useImagesStore()
    store.addAsset(makeAssetInput())
    store.clearAll()
    expect(store.assets).toHaveLength(0)
    expect(store.selectedId).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test -- tests/stores`
Expected: FAIL

- [ ] **Step 3: 实现 stores**

`src/stores/settings.ts`：

```ts
import { defineStore } from 'pinia'
import type { CompressMode, OutputFormat, ProcessOptions, ResizeOptions } from '../core/types'
import { computeTargetDimensions, type Dimensions } from '../core/processors/resize'

export interface SettingsState {
  outputFormat: OutputFormat
  mode: CompressMode
  quality: number
  targetPresetKb: number | null
  customTargetKb: number | null
  resizeEnabled: boolean
  width: number | null
  height: number | null
  keepAspectRatio: boolean
  autoSuffix: boolean
}

export const TARGET_PRESETS: Array<{ label: string; kb: number }> = [
  { label: '100 KB', kb: 100 },
  { label: '200 KB', kb: 200 },
  { label: '300 KB', kb: 300 },
  { label: '500 KB', kb: 500 },
  { label: '1 MB', kb: 1024 },
  { label: '2 MB', kb: 2048 },
]

export const QUICK_SIZES: Array<{ label: string; width: number; height: number }> = [
  { label: '640 × 480', width: 640, height: 480 },
  { label: '800 × 600', width: 800, height: 600 },
  { label: '1024 × 768', width: 1024, height: 768 },
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1280 × 960', width: 1280, height: 960 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '1920 × 1440', width: 1920, height: 1440 },
  { label: '2560 × 1440', width: 2560, height: 1440 },
  { label: '3840 × 2160', width: 3840, height: 2160 },
]

export const ID_PHOTO_PRESETS: Array<{ label: string; width: number; height: number }> = [
  { label: '一寸 295×413', width: 295, height: 413 },
  { label: '二寸 413×579', width: 413, height: 579 },
]

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    outputFormat: 'jpeg',
    mode: 'quality',
    quality: 80,
    targetPresetKb: 500,
    customTargetKb: null,
    resizeEnabled: false,
    width: null,
    height: null,
    keepAspectRatio: true,
    autoSuffix: true,
  }),
  actions: {
    setFormat(format: OutputFormat) {
      this.outputFormat = format
      if (format === 'png' && this.mode === 'targetSize') this.mode = 'quality'
    },
    setMode(mode: CompressMode) {
      this.mode = mode
    },
  },
})

/** 把 UI 设置映射为管线参数；参数不完整返回 null */
export function buildProcessOptions(
  s: SettingsState,
  original: Dimensions,
): ProcessOptions | null {
  if (s.mode === 'targetSize') {
    if (s.outputFormat === 'png') return null
    const kb = s.customTargetKb ?? s.targetPresetKb
    if (!kb || kb <= 0) return null
  }
  const options: ProcessOptions = {
    outputFormat: s.outputFormat,
    mode: s.mode,
  }
  if (s.mode === 'quality') {
    options.quality = Math.min(100, Math.max(1, Math.round(s.quality)))
  } else {
    const kb = (s.customTargetKb ?? s.targetPresetKb) as number
    options.targetSizeBytes = Math.round(kb * 1024)
  }
  if (s.resizeEnabled) {
    const dims = computeTargetDimensions(original, {
      width: s.width ?? 0,
      height: s.height ?? 0,
      keepAspectRatio: s.keepAspectRatio,
    })
    const resize: ResizeOptions = { ...dims, keepAspectRatio: s.keepAspectRatio }
    options.resize = resize
  }
  return options
}
```

`src/stores/images.ts`：

```ts
import { defineStore } from 'pinia'
import type { AssetStatus, ImageAsset, InputFormat, ProcessResult } from '../core/types'

let idSeq = 0

interface BatchState {
  active: boolean
  done: number
  total: number
  currentName: string
  finished: boolean
  successCount: number
  failedCount: number
}

const emptyBatch = (): BatchState => ({
  active: false,
  done: 0,
  total: 0,
  currentName: '',
  finished: false,
  successCount: 0,
  failedCount: 0,
})

export const useImagesStore = defineStore('images', {
  state: () => ({
    assets: [] as ImageAsset[],
    selectedId: null as string | null,
    batch: emptyBatch(),
  }),
  getters: {
    selected(state): ImageAsset | null {
      return state.assets.find((a) => a.id === state.selectedId) ?? null
    },
  },
  actions: {
    addAsset(input: {
      name: string
      bytes: number
      format: InputFormat
      width: number
      height: number
      file: Blob
      thumbUrl?: string
    }): ImageAsset {
      const asset: ImageAsset = {
        id: `img_${Date.now().toString(36)}_${++idSeq}`,
        status: 'pending',
        ...input,
      }
      this.assets.push(asset)
      if (!this.selectedId) this.selectedId = asset.id
      return asset
    },
    remove(id: string) {
      const idx = this.assets.findIndex((a) => a.id === id)
      if (idx === -1) return
      const [asset] = this.assets.splice(idx, 1)
      if (asset?.resultUrl) URL.revokeObjectURL(asset.resultUrl)
      if (asset?.thumbUrl?.startsWith('blob:')) URL.revokeObjectURL(asset.thumbUrl)
      if (this.selectedId === id) this.selectedId = this.assets[0]?.id ?? null
    },
    clearAll() {
      for (const a of this.assets) {
        if (a.resultUrl) URL.revokeObjectURL(a.resultUrl)
        if (a.thumbUrl?.startsWith('blob:')) URL.revokeObjectURL(a.thumbUrl)
      }
      this.assets = []
      this.selectedId = null
      this.resetBatch()
    },
    setStatus(id: string, status: AssetStatus, error?: string) {
      const asset = this.assets.find((a) => a.id === id)
      if (!asset) return
      asset.status = status
      asset.error = error
    },
    setResult(id: string, result: ProcessResult) {
      const asset = this.assets.find((a) => a.id === id)
      if (!asset) return
      if (asset.resultUrl) URL.revokeObjectURL(asset.resultUrl)
      asset.result = result
      asset.resultUrl = URL.createObjectURL(result.blob)
      asset.status = 'done'
      asset.error = undefined
    },
    resetResults() {
      for (const a of this.assets) {
        if (a.resultUrl) URL.revokeObjectURL(a.resultUrl)
        a.result = undefined
        a.resultUrl = undefined
        a.status = 'pending'
        a.error = undefined
      }
      this.resetBatch()
    },
    beginBatch(total: number) {
      this.batch = {
        active: true, done: 0, total, currentName: '',
        finished: false, successCount: 0, failedCount: 0,
      }
    },
    advanceBatch(name: string) {
      this.batch.currentName = name
    },
    completeItem(success: boolean) {
      this.batch.done += 1
      if (success) this.batch.successCount += 1
      else this.batch.failedCount += 1
    },
    finishBatch() {
      this.batch.active = false
      this.batch.finished = true
    },
    resetBatch() {
      this.batch = emptyBatch()
    },
  },
})
```

注意：`tests/stores/images.spec.ts` 的 happy-dom 需支持 `Blob`（原生 Node 提供）。`setResult` 涉及 `URL.createObjectURL`，不在单测覆盖，走人工验证。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test && pnpm typecheck`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores tests/stores
git commit -m "feat(stores): settings and image-library Pinia stores with options builder"
```

---

### Task 8: 导入编排与全局粘贴（composables）

**Files:**
- Create: `src/composables/usePaste.ts`, `src/composables/useFileImport.ts`, `src/composables/useToast.ts`, `src/components/common/ToastHost.vue`

**Interfaces:**
- Consumes: `sniffFile`（Task 2）、`decodeImage/createSurface/releaseBitmap`（Task 5）、`checkBytesGuard/checkPixelsGuard`（Task 3）、`useImagesStore`（Task 7）
- Produces:
  - `usePaste(onFiles: (files: File[]) => void)` — 组件挂载期监听 window paste
  - `useFileImport()` → `{ importFiles(files: File[], cb: ImportCallbacks): Promise<void> }`，其中 `interface ImportCallbacks { confirmOversize(reason: string): Promise<boolean>; onError(message: string): void }`
  - `useToast()` → `{ state, push(kind, text, duration?), dismiss(id) }`；`kind: 'error'|'info'|'success'`
  - `ToastHost.vue` — 渲染全局 toast 列表（App.vue 中挂载一次）

- [ ] **Step 1: 实现 usePaste**

`src/composables/usePaste.ts`：

```ts
import { onMounted, onUnmounted } from 'vue'

export function usePaste(onFiles: (files: File[]) => void): void {
  const handler = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (item.kind !== 'file') continue
      const f = item.getAsFile()
      if (f && f.type.startsWith('image/')) files.push(f)
    }
    if (files.length > 0) {
      e.preventDefault()
      onFiles(files)
    }
  }
  onMounted(() => window.addEventListener('paste', handler))
  onUnmounted(() => window.removeEventListener('paste', handler))
}
```

- [ ] **Step 2: 实现 useToast 与 ToastHost**

`src/composables/useToast.ts`：

```ts
import { reactive } from 'vue'

export interface ToastItem {
  id: number
  kind: 'error' | 'info' | 'success'
  text: string
}

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let seq = 0

export function useToast() {
  function push(kind: ToastItem['kind'], text: string, duration = 4000) {
    const id = ++seq
    state.items.push({ id, kind, text })
    setTimeout(() => dismiss(id), duration)
  }
  function dismiss(id: number) {
    const idx = state.items.findIndex((t) => t.id === id)
    if (idx !== -1) state.items.splice(idx, 1)
  }
  return { state, push, dismiss }
}
```

`src/components/common/ToastHost.vue`：

```vue
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
```

- [ ] **Step 3: 实现 useFileImport**

`src/composables/useFileImport.ts`：

```ts
import { checkBytesGuard, checkPixelsGuard } from '../core/guard'
import { createSurface, decodeImage, releaseBitmap } from '../core/codec'
import { sniffFile } from '../core/sniff'
import { useImagesStore } from '../stores/images'

export interface ImportCallbacks {
  confirmOversize: (reason: string) => Promise<boolean>
  onError: (message: string) => void
}

async function makeThumbUrl(bitmap: ImageBitmap): Promise<string> {
  const max = 320
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * ratio))
  const h = Math.max(1, Math.round(bitmap.height * ratio))
  const surface = createSurface(w, h)
  const ctx = surface.getContext('2d')
  if (!ctx) throw new Error('无法生成缩略图')
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
  if ('toDataURL' in surface) {
    return (surface as HTMLCanvasElement).toDataURL('image/jpeg', 0.8)
  }
  const blob = await (surface as OffscreenCanvas).convertToBlob({
    type: 'image/jpeg',
    quality: 0.8,
  })
  return URL.createObjectURL(blob)
}

function extFor(format: string): string {
  return format === 'jpeg' ? 'jpg' : format
}

export function useFileImport() {
  const images = useImagesStore()

  async function importFiles(files: File[], cb: ImportCallbacks): Promise<number> {
    let imported = 0
    for (const file of files) {
      try {
        const format = await sniffFile(file)
        if (format === 'unknown') {
          cb.onError(`不支持的图片格式：${file.name}`)
          continue
        }
        const bytesGuard = checkBytesGuard(file.size)
        if (bytesGuard.oversized) {
          const ok = await cb.confirmOversize(`${file.name}：${bytesGuard.reason}`)
          if (!ok) continue
        }
        const decoded = await decodeImage(file)
        try {
          const pxGuard = checkPixelsGuard(decoded.width, decoded.height)
          if (pxGuard.oversized) {
            const ok = await cb.confirmOversize(`${file.name}：${pxGuard.reason}`)
            if (!ok) continue
          }
          images.addAsset({
            name: file.name || `粘贴图片.${extFor(format)}`,
            bytes: file.size,
            format,
            width: decoded.width,
            height: decoded.height,
            file,
            thumbUrl: await makeThumbUrl(decoded.bitmap),
          })
          imported += 1
        } finally {
          releaseBitmap(decoded.bitmap)
        }
      } catch (err) {
        cb.onError(err instanceof Error ? err.message : `导入失败：${file.name}`)
      }
    }
    return imported
  }

  return { importFiles }
}
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `pnpm typecheck && pnpm build`
Expected: 无错误（ToastHost 尚未挂载属正常）

- [ ] **Step 5: Commit**

```bash
git add src/composables src/components/common/ToastHost.vue
git commit -m "feat(app): unified import pipeline composable, paste listener, toast system"
```

---

### Task 9: 基础 UI 组件库

**Files:**
- Create: `src/components/ui/BaseButton.vue`, `BaseCard.vue`, `RangeSlider.vue`, `SelectBox.vue`, `ToggleSwitch.vue`, `NumberField.vue`, `AppDialog.vue`

**Interfaces:**
- Produces（后续 UI 任务使用）:
  - `BaseButton`: props `{ variant?: 'primary'|'ghost'|'danger'; disabled?: boolean }`，emit `click`
  - `BaseCard`: 默认 slot 容器卡片
  - `RangeSlider`: v-model number，props `{ min?, max?, step? }`
  - `SelectBox`: v-model string，props `{ options: Array<{value,label}>, disabled? }`
  - `ToggleSwitch`: v-model boolean，props `{ label?, disabled? }`
  - `NumberField`: v-model `number|null`，props `{ placeholder?, min?, disabled? }`（空输入发 null）
  - `AppDialog`: props `{ open: boolean; title: string }`，emit `close`，默认 slot 为内容

- [ ] **Step 1: 实现 7 个组件**

`src/components/ui/BaseButton.vue`：

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }>(),
  { variant: 'primary', disabled: false },
)
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800': variant === 'primary',
      'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100': variant === 'ghost',
      'bg-red-50 text-red-600 hover:bg-red-100': variant === 'danger',
    }"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
```

`src/components/ui/BaseCard.vue`：

```vue
<template>
  <div class="rounded-xl border border-slate-200 bg-white shadow-sm"><slot /></div>
</template>
```

`src/components/ui/RangeSlider.vue`：

```vue
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
```

`src/components/ui/SelectBox.vue`：

```vue
<script setup lang="ts">
defineProps<{
  modelValue: string
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
    @change="onChange"
  >
    <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
</template>
```

`src/components/ui/ToggleSwitch.vue`：

```vue
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
```

`src/components/ui/NumberField.vue`：

```vue
<script setup lang="ts">
defineProps<{
  modelValue: number | null
  placeholder?: string
  min?: number
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  if (raw === '') {
    emit('update:modelValue', null)
    return
  }
  const n = Number(raw)
  emit('update:modelValue', Number.isFinite(n) ? n : null)
}
</script>

<template>
  <input
    type="number"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :min="min"
    :disabled="disabled"
    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
    @input="onInput"
  />
</template>
```

`src/components/ui/AppDialog.vue`：

```vue
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
```

- [ ] **Step 2: 类型检查 + 构建**

Run: `pnpm typecheck && pnpm build`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/ui
git commit -m "feat(ui): base component library (button/card/slider/select/switch/number/dialog)"
```

---

### Task 10: 首页与上传区（HomeView + Dropzone + App 壳）

**Files:**
- Modify: `src/App.vue`（替换占位实现）
- Create: `src/views/HomeView.vue`, `src/views/WorkspaceView.vue`（本任务先放最小桩，Task 11 替换）, `src/components/upload/Dropzone.vue`

**Interfaces:**
- Consumes: `BRAND`（Task 1）、`ACCEPTED_INPUT_TYPES`（Task 2）、`usePaste/useFileImport/useToast`（Task 8）、`AppDialog/BaseButton/BaseCard/ToastHost`（Task 9）
- Produces:
  - `App.vue`: 视图状态 `'home' | 'workspace'`；`HomeView` emit `start`；`WorkspaceView` emit `back-home`
  - `Dropzone.vue`: emit `files: [File[]]`；支持点击、拖拽

- [ ] **Step 1: 实现 Dropzone**

`src/components/upload/Dropzone.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ACCEPTED_INPUT_TYPES } from '../../core/sniff'

const emit = defineEmits<{ files: [File[]] }>()
const dragging = ref(false)
const inputRef = ref<HTMLInputElement>()

function pickFiles() {
  inputRef.value?.click()
}

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  emitFiles(input.files)
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  emitFiles(e.dataTransfer?.files)
}

function emitFiles(list: FileList | null | undefined) {
  if (!list || list.length === 0) return
  emit('files', Array.from(list))
}
</script>

<template>
  <div
    class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors"
    :class="
      dragging
        ? 'border-brand-500 bg-brand-50'
        : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40'
    "
    @click="pickFiles"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
      🖼️
    </div>
    <p class="text-base font-medium text-slate-700">拖拽图片到这里，或点击选择图片</p>
    <p class="text-sm text-slate-400">也可以直接 Ctrl + V 粘贴截图</p>
    <input
      ref="inputRef"
      type="file"
      multiple
      :accept="ACCEPTED_INPUT_TYPES"
      class="hidden"
      @change="onInputChange"
    />
  </div>
</template>
```

- [ ] **Step 2: 实现 HomeView**

`src/views/HomeView.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Dropzone from '../components/upload/Dropzone.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import AppDialog from '../components/ui/AppDialog.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { usePaste } from '../composables/usePaste'
import { useFileImport } from '../composables/useFileImport'
import { useToast } from '../composables/useToast'
import { useImagesStore } from '../stores/images'
import { BRAND } from '../content'

const emit = defineEmits<{ start: [] }>()
const images = useImagesStore()
const { push } = useToast()
const aboutOpen = ref(false)

const confirmVisible = ref(false)
const confirmReason = ref('')
let confirmResolve: ((ok: boolean) => void) | null = null

function askConfirm(reason: string): Promise<boolean> {
  confirmReason.value = reason
  confirmVisible.value = true
  return new Promise((resolve) => {
    confirmResolve = resolve
  })
}

function settleConfirm(ok: boolean) {
  confirmVisible.value = false
  confirmResolve?.(ok)
  confirmResolve = null
}

const { importFiles } = useFileImport()

async function handleFiles(files: File[]) {
  await importFiles(files, {
    confirmOversize: askConfirm,
    onError: (msg) => push('error', msg),
  })
  if (images.hasAssets) emit('start')
}

usePaste(handleFiles)

const quickActions = [
  { icon: '🗜️', label: '图片压缩', desc: '按质量或目标大小压缩' },
  { icon: '📐', label: '尺寸调整', desc: '锁定比例修改宽高' },
  { icon: '🆔', label: '像素修改', desc: '严格输出目标像素' },
  { icon: '🔄', label: '格式转换', desc: 'JPG / PNG / WEBP' },
]
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
    <header class="flex items-center justify-between py-5">
      <div class="text-lg font-bold tracking-tight">
        像素匠 <span class="text-brand-600">PixelForge</span>
      </div>
      <button class="text-sm text-slate-500 hover:text-slate-800" @click="aboutOpen = true">
        关于
      </button>
    </header>

    <main class="flex flex-1 flex-col items-center pt-10 pb-16">
      <h1 class="text-center text-4xl font-bold tracking-tight text-slate-900">
        {{ BRAND.heroTitle }}
      </h1>
      <p class="mt-3 text-center text-slate-500">{{ BRAND.heroSub }} —— {{ BRAND.slogan }}</p>
      <p class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
        {{ BRAND.privacyNote }}
      </p>

      <div class="mt-8 w-full max-w-2xl">
        <Dropzone @files="handleFiles" />
        <p class="mt-3 text-center text-xs text-slate-400">{{ BRAND.formatsLine }}</p>
      </div>

      <section class="mt-14 w-full max-w-3xl">
        <h2 class="mb-4 text-center text-sm font-medium tracking-wide text-slate-400">快速操作</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BaseCard
            v-for="action in quickActions"
            :key="action.label"
            class="cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            @click="emit('start')"
          >
            <div class="text-2xl">{{ action.icon }}</div>
            <div class="mt-2 text-sm font-semibold text-slate-800">{{ action.label }}</div>
            <div class="mt-0.5 text-xs text-slate-400">{{ action.desc }}</div>
          </BaseCard>
        </div>
      </section>
    </main>

    <AppDialog :open="confirmVisible" title="检测到超大图片" @close="settleConfirm(false)">
      <p class="text-sm text-slate-600">{{ confirmReason }}</p>
      <p class="mt-1 text-sm text-slate-500">继续处理可能占用较多内存。</p>
      <div class="mt-5 flex justify-end gap-2">
        <BaseButton variant="ghost" @click="settleConfirm(false)">取消</BaseButton>
        <BaseButton @click="settleConfirm(true)">继续处理</BaseButton>
      </div>
    </AppDialog>

    <AppDialog :open="aboutOpen" :title="BRAND.about.title" @close="aboutOpen = false">
      <p class="text-sm text-slate-600">{{ BRAND.about.body }}</p>
      <p class="mt-2 text-sm text-slate-500">{{ BRAND.slogan }}</p>
      <div class="mt-5 flex justify-end">
        <BaseButton variant="ghost" @click="aboutOpen = false">关闭</BaseButton>
      </div>
    </AppDialog>
  </div>
</template>
```

注意：这里用到了 `images.hasAssets` getter —— 在 Task 7 的 `images.ts` getters 中补一行：

```ts
hasAssets(state): boolean {
  return state.assets.length > 0
},
```

- [ ] **Step 3: 实现 WorkspaceView 桩 + 最终 App 壳**

`src/views/WorkspaceView.vue`（临时桩，Task 11 替换全部内容）：

```vue
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
```

`src/App.vue`（替换占位内容）：

```vue
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
```

- [ ] **Step 4: 类型检查 + 构建 + 测试**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部通过。注意 `tests/app.spec.ts` 现在挂载完整 App（含 Pinia 依赖）——把该测试改为：

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../src/App.vue'

describe('App bootstrap', () => {
  it('renders brand name', () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    expect(wrapper.text()).toContain('PixelForge')
  })
})
```

- [ ] **Step 5: 浏览器人工验证首页**

Run: `pnpm dev`
1. 拖一张图片进上传区 → 自动跳转工作台（桩页显示「工作台（建设中）」）
2. 点击上传区选择图片 → 同上
3. 复制一张截图后 Ctrl+V → 同上
4. 拖入一个 .txt 文件 → toast 提示「不支持的图片格式」，不跳转
5. 点击「关于」弹出关于弹窗
6. Network 面板确认无图片请求

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat(app): home view with dropzone/paste import and app shell"
```

---

### Task 11: 工作台三栏布局与图片列表

**Files:**
- Modify: `src/views/WorkspaceView.vue`（替换 Task 10 的桩）
- Create: `src/components/list/ImageList.vue`, `src/components/list/ImageCard.vue`

**Interfaces:**
- Consumes: `useImagesStore`、`formatBytes`、`ImageAsset` 类型
- Produces:
  - `ImageCard.vue`: props `{ asset: ImageAsset; active: boolean }`，emits `select` / `remove`
  - `ImageList.vue`: 直接读写 images store
  - `WorkspaceView.vue`: 三栏骨架；中栏含选中图预览与空态；顶部工具栏（返回/添加/清空）

- [ ] **Step 1: 实现 ImageCard**

`src/components/list/ImageCard.vue`：

```vue
<script setup lang="ts">
import type { AssetStatus, ImageAsset } from '../../core/types'
import { formatBytes } from '../../utils/format'

defineProps<{ asset: ImageAsset; active: boolean }>()
defineEmits<{ select: []; remove: [] }>()

const statusMeta: Record<AssetStatus, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'bg-slate-100 text-slate-500' },
  processing: { label: '处理中', cls: 'bg-blue-50 text-blue-600' },
  done: { label: '已完成', cls: 'bg-emerald-50 text-emerald-600' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-600' },
}
</script>

<template>
  <div
    class="group relative flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors"
    :class="active ? 'border-brand-500 bg-brand-50/60' : 'border-transparent hover:bg-slate-100'"
    @click="$emit('select')"
  >
    <img
      :src="asset.thumbUrl"
      alt=""
      class="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
    />
    <div class="min-w-0 flex-1">
      <p class="truncate pr-6 text-sm font-medium text-slate-800">{{ asset.name }}</p>
      <p class="mt-0.5 text-xs text-slate-400">
        {{ formatBytes(asset.bytes) }} · {{ asset.width }}×{{ asset.height }}
      </p>
      <p v-if="asset.status === 'failed'" class="mt-0.5 truncate text-xs text-red-500">
        {{ asset.error }}
      </p>
      <p v-else-if="asset.status === 'done' && asset.result" class="mt-0.5 text-xs text-emerald-600">
        {{ formatBytes(asset.result.bytes) }} · 省
        {{ formatBytes(Math.max(0, asset.bytes - asset.result.bytes)) }}
      </p>
    </div>
    <span
      class="absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[10px]"
      :class="statusMeta[asset.status].cls"
    >
      {{ statusMeta[asset.status].label }}
    </span>
    <button
      class="absolute right-2 bottom-2 hidden h-5 w-5 items-center justify-center rounded-full text-slate-400 group-hover:flex hover:bg-red-50 hover:text-red-500"
      title="删除"
      @click.stop="$emit('remove')"
    >
      ✕
    </button>
  </div>
</template>
```

- [ ] **Step 2: 实现 ImageList**

`src/components/list/ImageList.vue`：

```vue
<script setup lang="ts">
import { useImagesStore } from '../../stores/images'
import ImageCard from './ImageCard.vue'

const images = useImagesStore()
</script>

<template>
  <div class="space-y-1 overflow-y-auto">
    <ImageCard
      v-for="asset in images.assets"
      :key="asset.id"
      :asset="asset"
      :active="asset.id === images.selectedId"
      @select="images.selectedId = asset.id"
      @remove="images.remove(asset.id)"
    />
  </div>
</template>
```

- [ ] **Step 3: 实现三栏 WorkspaceView（右栏暂为参数占位）**

`src/views/WorkspaceView.vue`（整文件替换）：

```vue
<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import ImageList from '../components/list/ImageList.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { useFileImport } from '../composables/useFileImport'
import { usePaste } from '../composables/usePaste'
import { useToast } from '../composables/useToast'
import { useImagesStore } from '../stores/images'
import { ACCEPTED_INPUT_TYPES } from '../core/sniff'

defineEmits<{ backHome: [] }>()

const images = useImagesStore()
const { push } = useToast()
const { importFiles } = useFileImport()

const confirmVisible = ref(false)
const confirmReason = ref('')
let confirmResolve: ((ok: boolean) => void) | null = null

function askConfirm(reason: string): Promise<boolean> {
  confirmReason.value = reason
  confirmVisible.value = true
  return new Promise((resolve) => {
    confirmResolve = resolve
  })
}

function settleConfirm(ok: boolean) {
  confirmVisible.value = false
  confirmResolve?.(ok)
  confirmResolve = null
}

async function handleFiles(files: File[]) {
  await importFiles(files, {
    confirmOversize: askConfirm,
    onError: (msg) => push('error', msg),
  })
}
usePaste(handleFiles)

const addInputRef = ref<HTMLInputElement>()
function addMore() {
  addInputRef.value?.click()
}
function onAddChange(e: Event) {
  const input = e.target as HTMLInputElement
  void handleFiles(Array.from(input.files ?? []))
  input.value = ''
}

function clearAll() {
  if (images.assets.length === 0) return
  images.clearAll()
  push('info', '已清空全部图片')
}

/* 选中图原图预览 URL（无结果时用），随切换创建/回收 */
const previewUrl = ref('')
watchEffect((onCleanup) => {
  const asset = images.selected
  if (!asset || asset.resultUrl) return
  const url = URL.createObjectURL(asset.file)
  previewUrl.value = url
  onCleanup(() => URL.revokeObjectURL(url))
})

const selectedPreviewSrc = computed(() => images.selected?.resultUrl || previewUrl.value)
</script>

<template>
  <div class="flex min-h-screen flex-col px-4 pb-4">
    <!-- 顶部工具栏 -->
    <header class="flex items-center justify-between py-3">
      <button
        class="text-sm text-slate-500 hover:text-brand-600"
        @click="$emit('backHome')"
      >
        ← 返回首页
      </button>
      <div class="flex items-center gap-2 text-sm text-slate-400">
        共 {{ images.assets.length }} 张
      </div>
    </header>

    <main class="grid min-h-0 flex-1 grid-cols-[280px_1fr_340px] gap-4">
      <!-- 左栏：列表 -->
      <aside class="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-2">
        <div class="mb-2 flex gap-2">
          <BaseButton variant="ghost" class="flex-1 !px-2 text-xs" @click="addMore">＋ 添加图片</BaseButton>
          <BaseButton variant="danger" class="!px-2 text-xs" @click="clearAll">清空</BaseButton>
          <input
            ref="addInputRef"
            type="file"
            multiple
            :accept="ACCEPTED_INPUT_TYPES"
            class="hidden"
            @change="onAddChange"
          />
        </div>
        <ImageList v-if="images.assets.length > 0" class="min-h-0 flex-1" />
        <p v-else class="mt-10 self-center text-xs text-slate-300">暂无图片</p>
      </aside>

      <!-- 中栏：预览 -->
      <section class="flex min-h-0 flex-col gap-3">
        <div
          v-if="images.selected"
          class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <img :src="selectedPreviewSrc" class="max-h-full max-w-full object-contain" alt="预览" />
        </div>
        <div
          v-else
          class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-400"
        >
          从左侧选择一张图片查看预览
        </div>
        <!-- 参数区占位：Task 12 替换 -->
      </section>

      <!-- 右栏：参数面板占位 -->
      <aside class="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
        参数面板（Task 12）
      </aside>
    </main>

    <!-- 超大图确认框 -->
    <Teleport to="body">
      <div v-if="confirmVisible" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <div class="relative z-10 w-[min(92vw,420px)] rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-2 text-base font-semibold">检测到超大图片</h3>
          <p class="text-sm text-slate-600">{{ confirmReason }}</p>
          <p class="mt-1 text-sm text-slate-500">继续处理可能占用较多内存。</p>
          <div class="mt-5 flex justify-end gap-2">
            <BaseButton variant="ghost" @click="settleConfirm(false)">取消</BaseButton>
            <BaseButton @click="settleConfirm(true)">继续处理</BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
```

说明：中栏底部的「参数区占位」注释行在 Task 12 中会被替换为 `<SettingsPanel />` 与处理按钮。

- [ ] **Step 4: 类型检查 + 构建 + 测试**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部通过

- [ ] **Step 5: 浏览器人工验证**

Run: `pnpm dev`，从首页进入：
1. 列表显示缩略图、文件名、大小、尺寸、状态徽标
2. 点击卡片切换选中（高亮边框）
3. 中栏显示选中图大图预览
4. 「＋ 添加图片」可继续追加；悬停卡片出现 ✕ 可删除；「清空」清空并回空态
5. 返回首页正常

- [ ] **Step 6: Commit**

```bash
git add src/views src/components/list
git commit -m "feat(workspace): three-pane workspace with image list and preview pane"
```

---

### Task 12: 参数面板（SettingsPanel）

**Files:**
- Create: `src/components/settings/SettingsPanel.vue`
- Modify: `src/views/WorkspaceView.vue`（右栏接入面板）

**Interfaces:**
- Consumes: settings store（含 `TARGET_PRESETS/QUICK_SIZES/ID_PHOTO_PRESETS`）、`computeTargetDimensions`、UI 基础组件
- Produces: `SettingsPanel.vue` —— 无 props/emits，直接读写两个 Pinia store；锁定比例时宽度变化自动推算高度（以选中图原始比例为基准），高度变化同理反推

- [ ] **Step 1: 实现 SettingsPanel**

`src/components/settings/SettingsPanel.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import BaseCard from '../ui/BaseCard.vue'
import RangeSlider from '../ui/RangeSlider.vue'
import SelectBox from '../ui/SelectBox.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import NumberField from '../ui/NumberField.vue'
import {
  ID_PHOTO_PRESETS,
  QUICK_SIZES,
  TARGET_PRESETS,
  useSettingsStore,
} from '../../stores/settings'
import { useImagesStore } from '../../stores/images'

const settings = useSettingsStore()
const images = useImagesStore()

const formatOptions = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WEBP' },
]
const modeOptions = [
  { value: 'quality', label: '按质量压缩' },
  { value: 'targetSize', label: '按目标大小' },
]

/** PNG 为无损格式，不支持目标大小模式 */
const targetDisabled = computed(() => settings.outputFormat === 'png')

const selected = computed(() => images.selected)

function onWidthInput(w: number | null) {
  settings.width = w
  if (settings.keepAspectRatio && w && selected.value && selected.value.width > 0) {
    settings.height = Math.max(1, Math.round((w * selected.value.height) / selected.value.width))
  }
}

function onHeightInput(h: number | null) {
  settings.height = h
  if (settings.keepAspectRatio && h && selected.value && selected.value.height > 0) {
    settings.width = Math.max(1, Math.round((h * selected.value.width) / selected.value.height))
  }
}

function toggleKeepAspect(v: boolean) {
  settings.keepAspectRatio = v
  if (v) onWidthInput(settings.width)
}

function applyPreset(preset: { width: number; height: number }) {
  settings.resizeEnabled = true
  settings.keepAspectRatio = false
  settings.width = preset.width
  settings.height = preset.height
}
</script>

<template>
  <div class="space-y-3">
    <!-- 输出格式与质量 -->
    <BaseCard class="space-y-3 p-4">
      <p class="text-xs font-semibold tracking-wide text-slate-400">输出设置</p>
      <div class="flex gap-2">
        <button
          v-for="f in formatOptions"
          :key="f.value"
          class="flex-1 rounded-lg border px-2 py-1.5 text-sm transition-colors"
          :class="
            settings.outputFormat === f.value
              ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          "
          @click="settings.setFormat(f.value as 'jpeg' | 'png' | 'webp')"
        >
          {{ f.label }}
        </button>
      </div>

      <ToggleSwitch v-model="settings.autoSuffix" label="自动添加处理后缀" />

      <p class="text-xs text-slate-400">
        后缀规则：_compressed，或开启尺寸后输出 _宽x高
      </p>
    </BaseCard>

    <!-- 压缩模式 -->
    <BaseCard class="space-y-3 p-4">
      <p class="text-xs font-semibold tracking-wide text-slate-400">压缩模式</p>
      <SelectBox v-model="settings.mode" :options="modeOptions" />

      <template v-if="settings.mode === 'quality'">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-600">质量</span>
          <span class="font-medium text-brand-600">{{ settings.quality }}%</span>
        </div>
        <RangeSlider v-model="settings.quality" :min="1" :max="100" />
        <div class="flex justify-between text-[10px] text-slate-300">
          <span>极限压缩</span><span>高质量</span>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="p in TARGET_PRESETS"
            :key="p.kb"
            class="rounded-lg border px-2 py-1.5 text-xs transition-colors disabled:opacity-40"
            :class="
              !targetDisabled && settings.customTargetKb === null && settings.targetPresetKb === p.kb
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            "
            :disabled="targetDisabled"
            @click="settings.customTargetKb = null; settings.targetPresetKb = p.kb"
          >
            {{ p.label }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <span class="shrink-0 text-xs text-slate-500">自定义 KB</span>
          <NumberField
            v-model="settings.customTargetKb"
            :min="1"
            placeholder="如 800"
            :disabled="targetDisabled"
          />
        </div>
        <p v-if="targetDisabled" class="text-xs text-red-500">
          PNG 为无损格式，不支持按目标大小；请选择 JPG 或 WEBP。
        </p>
      </template>
    </BaseCard>

    <!-- 尺寸 / 像素调整 -->
    <BaseCard class="space-y-3 p-4">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold tracking-wide text-slate-400">尺寸调整</p>
        <ToggleSwitch v-model="settings.resizeEnabled" />
      </div>

      <template v-if="settings.resizeEnabled">
        <div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label class="space-y-1">
            <span class="text-xs text-slate-500">宽度 px</span>
            <NumberField v-model="settings.width" :min="1" placeholder="1920" @update:model-value="onWidthInput" />
          </label>
          <span class="pb-2 text-slate-300">×</span>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">高度 px</span>
            <NumberField v-model="settings.height" :min="1" placeholder="1080" @update:model-value="onHeightInput" />
          </label>
        </div>
        <ToggleSwitch
          :model-value="settings.keepAspectRatio"
          label="保持原始比例（以宽度为准）"
          @update:model-value="toggleKeepAspect"
        />

        <p class="pt-1 text-xs text-slate-400">快捷尺寸</p>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="q in QUICK_SIZES"
            :key="q.label"
            class="rounded-md border border-slate-200 px-1 py-1 text-[11px] text-slate-600 hover:border-brand-400 hover:text-brand-600"
            @click="applyPreset(q)"
          >
            {{ q.label }}
          </button>
        </div>

        <p class="pt-1 text-xs text-slate-400">证件照像素（严格输出）</p>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="p in ID_PHOTO_PRESETS"
            :key="p.label"
            class="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-600"
            @click="applyPreset(p)"
          >
            {{ p.label }}
          </button>
        </div>
      </template>
    </BaseCard>
  </div>
</template>
```

注意：`settings.mode` 直接通过 `v-model` 写入 Pinia state（store state 可直接变更）；`setFormat` 保留为 action 是因为切换 PNG 时需要联动降级压缩模式。

- [ ] **Step 2: 接入 WorkspaceView 右栏**

修改 `src/views/WorkspaceView.vue`：

script 增加 import：

```ts
import SettingsPanel from '../components/settings/SettingsPanel.vue'
```

模板中将右栏占位 aside 替换为：

```vue
<aside class="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3">
  <SettingsPanel />
</aside>
```

- [ ] **Step 3: 类型检查 + 构建 + 测试**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部通过

- [ ] **Step 4: 浏览器人工验证**

Run: `pnpm dev`：
1. 切换 PNG → 目标大小模式下被禁用并显示红字提示；若当前在目标模式则自动回到质量模式
2. 开启尺寸调整，输入宽度 → 高度按选中图比例自动计算；关闭锁比例后输入 295×413 不再联动
3. 点「一寸 295×413」→ 宽高精确填充且锁比例关闭
4. 质量滑杆拖动显示百分比

- [ ] **Step 5: Commit**

```bash
git add src/components/settings src/views/WorkspaceView.vue
git commit -m "feat(settings): full parameter panel with presets, lock-ratio and PNG guard"
```

---

### Task 13: 处理编排、进度、结果与导出

**Files:**
- Create: `src/utils/download.ts`, `src/components/batch/ProgressOverlay.vue`, `src/components/results/ResultStats.vue`
- Modify: `src/views/WorkspaceView.vue`（开始处理 + 编排 + 下载按钮 + 进度浮层）

**Interfaces:**
- Consumes: `createProcessor/defaultPoolSize/ImageProcessor`（Task 6）、`buildProcessOptions`（Task 7）、images/settings stores、`buildOutputName/uniqueName`（Task 3）、`compressionRatio/formatBytes`
- Produces:
  - `downloadBlob(blob: Blob, filename: string): void`
  - `downloadResultsZip(entries: Array<{ assetName: string; result: ProcessResult }>, opts: { suffixKind: 'none'|'compressed'|'dimensions' }): Promise<void>`（打包名固定 `pixel-forge-result.zip`，ZIP 内部 level 0 不重复压缩）
  - `ProgressOverlay.vue`: 读 images.batch，emit `download-zip` / `close`
  - `ResultStats.vue`: props `{ asset: ImageAsset }`

- [ ] **Step 1: 实现 download 工具**

`src/utils/download.ts`：

```ts
import { zipSync } from 'fflate'
import type { ProcessResult } from '../core/types'
import { buildOutputName, uniqueName } from './naming'

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ZipEntry {
  assetName: string
  result: ProcessResult
}

export async function downloadResultsZip(
  entries: ZipEntry[],
  opts: { suffixKind: 'none' | 'compressed' | 'dimensions' },
): Promise<void> {
  const files: Record<string, Uint8Array> = {}
  const taken = new Set<string>()
  for (const { assetName, result } of entries) {
    const bytes = new Uint8Array(await result.blob.arrayBuffer())
    const name = uniqueName(
      buildOutputName(assetName, {
        ext: result.format,
        suffixKind: opts.suffixKind,
        width: result.width,
        height: result.height,
      }),
      taken,
    )
    taken.add(name)
    files[name] = bytes
  }
  const zipped = zipSync(files, { level: 0 })
  downloadBlob(new Blob([zipped as BlobPart], { type: 'application/zip' }), 'pixel-forge-result.zip')
}

export function resultFileName(
  originalName: string,
  result: ProcessResult,
  suffixKind: 'none' | 'compressed' | 'dimensions',
): string {
  return uniqueName(
    buildOutputName(originalName, {
      ext: result.format,
      suffixKind,
      width: result.width,
      height: result.height,
    }),
    new Set(),
  )
}
```

- [ ] **Step 2: 实现 ResultStats**

`src/components/results/ResultStats.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { ImageAsset } from '../../core/types'
import { compressionRatio, formatBytes } from '../../utils/format'

const props = defineProps<{ asset: ImageAsset }>()

const saved = computed(() =>
  props.asset.result ? Math.max(0, props.asset.bytes - props.asset.result.bytes) : 0,
)
const ratio = computed(() =>
  props.asset.result ? compressionRatio(props.asset.bytes, props.asset.result.bytes) : 0,
)
const formatLabel = computed(() => props.asset.result?.format.toUpperCase() ?? '')
</script>

<template>
  <div
    v-if="asset.result"
    class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm"
  >
    <div>
      <p class="text-xs text-slate-400">原始</p>
      <p class="font-semibold text-slate-800">{{ formatBytes(asset.bytes) }}</p>
      <p class="text-xs text-slate-400">{{ asset.width }}×{{ asset.height }}</p>
    </div>
    <div class="flex flex-col items-center">
      <span class="text-lg text-brand-600">↓</span>
      <span class="text-xs font-semibold text-emerald-600">-{{ ratio }}%</span>
      <span class="text-xs text-slate-400">省 {{ formatBytes(saved) }}</span>
    </div>
    <div class="text-right">
      <p class="text-xs text-slate-400">处理后</p>
      <p class="font-semibold text-slate-800">{{ formatBytes(asset.result.bytes) }}</p>
      <p class="text-xs text-slate-400">{{ asset.result.width }}×{{ asset.result.height }} · {{ formatLabel }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 实现 ProgressOverlay**

`src/components/batch/ProgressOverlay.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useImagesStore } from '../../stores/images'
import BaseButton from '../ui/BaseButton.vue'

defineEmits<{ 'download-zip': []; close: [] }>()

const images = useImagesStore()

const percent = computed(() =>
  images.batch.total > 0 ? Math.round((images.batch.done / images.batch.total) * 100) : 0,
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="images.batch.active || images.batch.finished"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
    >
      <div class="w-[min(92vw,460px)] rounded-2xl bg-white p-6 shadow-xl">
        <template v-if="images.batch.active">
          <h3 class="text-base font-semibold">正在处理…</h3>
          <p class="mt-1 truncate text-sm text-slate-500">{{ images.batch.currentName }}</p>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-brand-600 transition-all duration-200"
              :style="{ width: percent + '%' }"
            />
          </div>
          <p class="mt-2 text-right text-sm text-slate-400">
            {{ images.batch.done }} / {{ images.batch.total }}
          </p>
        </template>

        <template v-else>
          <h3 class="text-base font-semibold">处理完成</h3>
          <p class="mt-2 text-sm">
            <span class="font-medium text-emerald-600">成功 {{ images.batch.successCount }}</span>
            <span class="mx-2 text-slate-300">|</span>
            <span :class="images.batch.failedCount ? 'font-medium text-red-500' : 'text-slate-400'">
              失败 {{ images.batch.failedCount }}
            </span>
          </p>
          <p v-if="images.batch.failedCount" class="mt-1 text-xs text-slate-400">
            失败原因见左侧列表中标红条目。
          </p>
          <div class="mt-5 flex justify-end gap-2">
            <BaseButton variant="ghost" @click="$emit('close')">关闭</BaseButton>
            <BaseButton :disabled="images.batch.successCount === 0" @click="$emit('download-zip')">
              下载 ZIP
            </BaseButton>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
```

- [ ] **Step 4: WorkspaceView 接入处理编排与下载**

修改 `src/views/WorkspaceView.vue`。

script 部分新增 import：

```ts
import ProgressOverlay from '../components/batch/ProgressOverlay.vue'
import ResultStats from '../components/results/ResultStats.vue'
import CompareViewerStub from './CompareViewerStub.vue'
import {
  createProcessor,
  defaultPoolSize,
  type ImageProcessor,
} from '../workers/pool'
import { buildProcessOptions } from '../stores/settings'
import { downloadBlob, downloadResultsZip, resultFileName } from '../utils/download'
import type { ImageAsset, ProcessOptions } from '../core/types'
```

说明：中栏对比查看器本任务先用桩组件，Task 14 替换。创建临时桩 `src/views/CompareViewerStub.vue`：

```vue
<script setup lang="ts">
defineProps<{ original: Blob; result: Blob }>()
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
    对比视图加载完成（Task 14 提供滑块对比）
  </div>
</template>
```

script 新增处理逻辑：

```ts
const settings = useSettingsStore()
const selected = computed(() => images.selected)

let processor: ImageProcessor | null = null
function getProcessor(): ImageProcessor {
  processor ??= createProcessor()
  return processor
}

const busy = computed(() => images.batch.active)

function suffixKind(): 'none' | 'compressed' | 'dimensions' {
  if (!settings.autoSuffix) return 'none'
  return settings.resizeEnabled && settings.width && settings.height
    ? 'dimensions'
    : 'compressed'
}

async function startProcessing() {
  if (images.assets.length === 0 || busy.value) return

  /* 参数校验：任何一张无法构建参数即整体拦截 */
  const prepared = new Map<string, ProcessOptions>()
  for (const asset of images.assets) {
    const options = buildProcessOptions(settings.$state, asset)
    if (!options) {
      push('error', '参数不完整：请检查目标大小设置或格式组合')
      return
    }
    prepared.set(asset.id, options)
  }

  images.resetResults()
  images.beginBatch(images.assets.length)

  let warnedUnreachable = false
  const waveSize = defaultPoolSize()
  const list = images.assets.slice()

  for (let i = 0; i < list.length; i += waveSize) {
    const wave = list.slice(i, i + waveSize)
    await Promise.all(wave.map((asset) => processOne(asset)))
  }

  images.finishBatch()
  push('success', `处理完成：成功 ${images.batch.successCount} 张${images.batch.failedCount ? `，失败 ${images.batch.failedCount} 张` : ''}`)

  async function processOne(asset: ImageAsset) {
    images.setStatus(asset.id, 'processing')
    images.advanceBatch(asset.name)
    try {
      const result = await getProcessor().process(asset.file, prepared.get(asset.id)!)
      images.setResult(asset.id, result)
      images.completeItem(true)
      if (!result.fitsTarget && !warnedUnreachable) {
        warnedUnreachable = true
        push('info', '部分图片即使最低质量也无法达到目标大小，已输出尽可能小的结果')
      }
    } catch (err) {
      images.setStatus(asset.id, 'failed', err instanceof Error ? err.message : '处理失败')
      images.completeItem(false)
    }
  }
}

const doneAssets = computed(() => images.assets.filter((a) => a.status === 'done' && a.result))

function downloadSelected() {
  const asset = images.selected
  if (!asset?.result) return
  downloadBlob(asset.result.blob, resultFileName(asset.name, asset.result, suffixKind()))
}

async function downloadZip() {
  if (doneAssets.value.length === 0) return
  await downloadResultsZip(
    doneAssets.value.map(({ name, result }) => ({ assetName: name, result: result! })),
    { suffixKind: suffixKind() },
  )
  push('success', `已打包 ${doneAssets.value.length} 张图片`)
}

function closeOverlay() {
  images.resetBatch()
}
```

并在 script 中确认已有 import：`import { useSettingsStore, buildProcessOptions } from '../stores/settings'`（`useSettingsStore` 若 Task 11 尚未引入则一并补上；Task 12 已引入 `SettingsPanel`，其内部自用 settings store）。

模板改动：

1. 右栏 `<SettingsPanel />` 下方追加操作区（仍在右栏 aside 内）：

```vue
<div class="sticky bottom-0 mt-3 space-y-2 bg-gradient-to-t from-slate-50 pt-2">
  <BaseButton
    class="w-full"
    :disabled="images.assets.length === 0 || busy"
    @click="startProcessing"
  >
    {{ busy ? '处理中…' : `开始处理（${images.assets.length} 张）` }}
  </BaseButton>
  <div v-if="selected && selected.status === 'done'" class="flex gap-2">
    <BaseButton variant="ghost" class="flex-1 !px-2 text-xs" @click="downloadSelected">
      下载当前
    </BaseButton>
  </div>
  <BaseButton
    v-if="doneAssets.length > 1"
    variant="ghost"
    class="w-full !px-2 text-xs"
    @click="downloadZip"
  >
    下载全部 ZIP（{{ doneAssets.length }} 张）
  </BaseButton>
</div>
```

2. 中栏预览区改造：有结果时用对比视图，无结果显示原图，结果下方挂统计卡。把中栏 `<section>` 内容整体替换为：

```vue
<section class="flex min-h-0 flex-col gap-3 overflow-y-auto">
  <template v-if="selected">
    <CompareViewerStub
      v-if="selected.result"
      :original="selected.file"
      :result="selected.result.blob"
      class="shrink-0"
    />
    <div
      v-else
      class="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white"
    >
      <img :src="previewUrl" class="max-h-[60vh] object-contain" alt="原图预览" />
    </div>
    <ResultStats v-if="selected.status === 'done'" :asset="selected" />
  </template>
  <div
    v-else
    class="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-400"
  >
    从左侧选择一张图片查看预览
  </div>
</section>
```

同时删除原 `selectedPreviewSrc` computed（不再使用），保留 `previewUrl` watchEffect。

3. 模板末尾（确认框 Teleport 之后）追加浮层：

```vue
<ProgressOverlay @download-zip="downloadZip" @close="closeOverlay" />
```

- [ ] **Step 5: 类型检查 + 构建 + 测试**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部通过

- [ ] **Step 6: 浏览器人工验证（核心场景）**

准备 2~3 张本地照片（其中一张 >1MB）：

1. 质量 80% 处理 → 列表出现「已完成」与绿色节省信息；ResultStats 显示前后大小与压缩率
2. 目标大小选 500KB 处理 → 结果均 ≤500KB；切换 WEBP 再试同样达标
3. 尺寸 295×413（关锁比例）处理 → 下载当前文件，属性确认为 295×413
4. 宽度 1920 锁比例处理 → 结果 1920×(按比例)
5. 故意放入一张 .txt 改名为 .jpg → 该张标记失败并显示「图片无法解码」，其余正常
6. 多张完成后点「下载全部 ZIP」→ 得到 pixel-forge-result.zip，解压核对数量与命名后缀
7. Network 面板全程无图片上传请求
8. 处理期间 UI 可正常滚动、点击，不卡死（Worker 生效）

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(workspace): batch orchestration, progress overlay, stats and zip export"
```

---

### Task 14: 原图/处理后对比查看器（滑块 + 并排）

**Files:**
- Create: `src/components/preview/CompareViewer.vue`
- Delete: `src/views/CompareViewerStub.vue`
- Modify: `src/views/WorkspaceView.vue`（替换引用）

**Interfaces:**
- Consumes: 无外部依赖（Blob URL 自管理）
- Produces: `CompareViewer.vue` —— props `{ original: Blob; result: Blob }`；内部提供「滑块 / 并排」两种模式切换；组件卸载或 props 变化时自动 revoke ObjectURL

- [ ] **Step 1: 实现 CompareViewer**

`src/components/preview/CompareViewer.vue`：

```vue
<script setup lang="ts">
import { ref, watchEffect } from 'vue'

const props = defineProps<{ original: Blob; result: Blob }>()

const mode = ref<'slider' | 'split'>('slider')
const pos = ref(50)
const container = ref<HTMLDivElement | null>(null)
const dragging = ref(false)

const originalUrl = ref('')
const resultUrl = ref('')

watchEffect((onCleanup) => {
  const o = URL.createObjectURL(props.original)
  const r = URL.createObjectURL(props.result)
  originalUrl.value = o
  resultUrl.value = r
  onCleanup(() => {
    URL.revokeObjectURL(o)
    URL.revokeObjectURL(r)
  })
})

function pointerPos(e: PointerEvent): number {
  const el = container.value
  if (!el) return pos.value
  const rect = el.getBoundingClientRect()
  return Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
}

function onDown(e: PointerEvent) {
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  pos.value = pointerPos(e)
}
function onMove(e: PointerEvent) {
  if (dragging.value) pos.value = pointerPos(e)
}
function onUp() {
  dragging.value = false
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <p class="text-sm text-slate-500">原图 / 处理后 对比</p>
      <div class="flex overflow-hidden rounded-lg border border-slate-200 text-xs">
        <button
          class="px-3 py-1"
          :class="mode === 'slider' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'"
          @click="mode = 'slider'"
        >
          滑块对比
        </button>
        <button
          class="px-3 py-1"
          :class="mode === 'split' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'"
          @click="mode = 'split'"
        >
          左右并排
        </button>
      </div>
    </div>

    <div v-if="mode === 'split'" class="grid grid-cols-2 gap-2">
      <figure class="overflow-hidden rounded-xl border border-slate-100">
        <figcaption class="bg-slate-800 px-2 py-1 text-center text-xs text-white">原图</figcaption>
        <div class="flex h-[380px] items-center justify-center bg-slate-50">
          <img :src="originalUrl" class="max-h-full max-w-full object-contain" draggable="false" />
        </div>
      </figure>
      <figure class="overflow-hidden rounded-xl border border-slate-100">
        <figcaption class="bg-brand-600 px-2 py-1 text-center text-xs text-white">处理后</figcaption>
        <div class="flex h-[380px] items-center justify-center bg-slate-50">
          <img :src="resultUrl" class="max-h-full max-w-full object-contain" draggable="false" />
        </div>
      </figure>
    </div>

    <div
      v-else
      ref="container"
      class="relative h-[420px] cursor-ew-resize touch-none overflow-hidden rounded-xl bg-slate-50 select-none"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <img
        :src="resultUrl"
        class="absolute inset-0 mx-auto h-full w-auto max-w-none object-contain"
        style="left: 50%; transform: translateX(-50%)"
        draggable="false"
      />
      <img
        :src="originalUrl"
        class="absolute inset-0 mx-auto h-full w-auto max-w-none object-contain"
        style="left: 50%; transform: translateX(-50%)"
        :style="{ clipPath: `inset(0 ${100 - pos}% 0 0)` }"
        draggable="false"
      />
      <div
        class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-md"
        :style="{ left: pos + '%' }"
      >
        <span
          class="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs text-slate-500 shadow-md"
        >
          ⇄
        </span>
      </div>
      <span class="absolute top-2 left-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-xs text-white">原图</span>
      <span class="absolute top-2 right-2 rounded bg-brand-600/90 px-1.5 py-0.5 text-xs text-white">处理后</span>
    </div>
  </div>
</template>
```

说明：两张图都水平居中（`left:50% + translateX(-50%)`），保证尺寸不同的原图与结果在同一中轴上对齐，滑块左右分别裁剪显示。

- [ ] **Step 2: WorkspaceView 替换桩**

删除 `src/views/CompareViewerStub.vue` 文件。修改 WorkspaceView script import：

```ts
import CompareViewer from '../components/preview/CompareViewer.vue'
```

模板中将 `<CompareViewerStub ... />` 标签替换为 `<CompareViewer :original="selected.file" :result="selected.result.blob" class="shrink-0" />`。

- [ ] **Step 3: 类型检查 + 构建 + 测试**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部通过

- [ ] **Step 4: 浏览器人工验证**

Run: `pnpm dev`，处理一张图后选中：
1. 默认滑块模式：拖动分割线，左侧原图右侧结果平滑切换
2. 切换「左右并排」：双栏对照
3. 在列表切换其他图片 → 对比内容正确跟随、无内存泄漏（Performance monitor 观察 DOM node 数稳定）

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(preview): slider and side-by-side before/after compare viewer"
```

---

### Task 15: 边界加固与空态完善

**Files:**
- Modify: `src/views/WorkspaceView.vue`, `src/App.vue`

**Interfaces:**
- Consumes: 现有全部模块
- Produces: 行为加固（无新接口）：
  1. Worker 全灭场景兜底：所有 worker onerror 已在 pool 中重建并 reject 单任务——验证失败任务不阻塞后续批次
  2. `App.vue` 增加 `window.onerror` 同步错误监听（与 unhandledrejection 并列）
  3. 首页在已有图片时再次上传 → 追加而非覆盖（现状即追加，验证即可）
  4. 处理进行中禁用「清空」「开始处理」「下载」入口

- [ ] **Step 1: App.vue 补充同步错误监听**

script 中追加（与现有 onUnhandled 相邻）：

```ts
function onWindowError(e: ErrorEvent) {
  push('error', `脚本错误：${e.message}`)
}
onMounted(() => window.addEventListener('error', onWindowError))
onUnmounted(() => window.removeEventListener('error', onWindowError))
```

- [ ] **Step 2: WorkspaceView 加固交互锁**

script 追加 computed：

```ts
const canEdit = computed(() => !busy.value)
```

模板绑定调整：
- 「清空」按钮：`:disabled="!canEdit"`（BaseButton 支持 disabled prop）
- 「＋ 添加图片」按钮与隐藏 input：busy 时点击无效即可（input click 由函数控制）：`addMore()` 改为 `if (!canEdit.value) return; addInputRef.value?.click()`

- [ ] **Step 3: 类型检查 + 构建 + 测试**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat(app): global error hardening and busy-state interaction locks"
```

---

### Task 16: 测试夹具、README 与 PRD 六大场景验收

**Files:**
- Create: `scripts/make-fixtures.mjs`, `README.md`

**Interfaces:**
- Consumes: 全部完成的应用
- Produces: 可复现的验收流程文档与 BMP 测试夹具生成脚本

- [ ] **Step 1: 实现夹具生成脚本（纯 Node 写 24 位 BMP）**

`scripts/make-fixtures.mjs`：

```js
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'fixtures')
mkdirSync(outDir, { recursive: true })

/** 渐变 + 色块图案，便于肉眼确认缩放/压缩效果 */
function makeBmp(width, height, file) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowSize * height
  const fileSize = 54 + pixelBytes
  const buf = Buffer.alloc(fileSize)

  buf.write('BM', 0)
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(pixelBytes, 34)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = 54 + y * rowSize + x * 3
      buf[i] = (x * 255) / width       // B
      buf[i + 1] = (y * 255) / height  // G
      buf[i + 2] = ((x ^ y) % 64) * 4  // R
    }
  }
  writeFileSync(join(outDir, file), buf)
  console.log(`written ${file} (${width}x${height}, ${(fileSize / 1048576).toFixed(1)}MB)`)
}

makeBmp(1600, 1200, 'sample-1600x1200.bmp')
makeBmp(295, 413, 'sample-idphoto-size.bmp')
```

运行：`node scripts/make-fixtures.mjs` → 生成 `fixtures/*.bmp`（BMP 仅用于导入测试；大文件压缩场景用你自己的照片更真实）。把 `fixtures/` 加入 `.gitignore`。

- [ ] **Step 2: 编写 README.md**

`README.md`：

```markdown
# 像素匠 PixelForge

> 让每一张图片，都刚刚好。

本地图片压缩与处理工具：图片默认在你的浏览器内处理，不上传任何服务器。

## 功能（v1 / P0）

- 上传：点击选择 / 拖拽 / Ctrl+V 粘贴
- 压缩：按质量（1–100%）或按目标文件大小（二分搜索最优质量）
- 尺寸调整：锁定比例、快捷尺寸
- 像素修改：严格输出目标像素（如证件照 295×413）
- 格式转换：JPG / PNG / WEBP
- 批量处理 + ZIP 打包导出
- 原图/处理后 滑块 & 并排对比
- 大图保护、单张失败隔离、全程本地隐私

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm test       # Vitest 单测
pnpm typecheck  # vue-tsc
pnpm build      # 生产构建
node scripts/make-fixtures.mjs   # 生成 BMP 测试夹具到 fixtures/
```

## 架构

- `src/core/` 平台无关处理核心（类型/嗅探/几何/守卫/求解器/管线），零 Vue 依赖
- `src/workers/` Web Worker 入口与调度池（主线程回退）
- `src/stores/` Pinia：设置与图片库状态
- `src/views/`+`src/components/` UI 层（Tailwind v4，自绘组件）

详细设计见 `docs/superpowers/specs/`。
```

- [ ] **Step 3: 全量回归**

Run: `pnpm test && pnpm typecheck && pnpm build && pnpm preview`
Expected: 测试全绿、构建成功、preview 正常打开

- [ ] **Step 4: PRD 第三十八节六大场景人工验收清单**

逐项执行并在每项后记录结果：

1. **普通压缩**：导入 ≥5MB JPG → 质量 80% 开始处理 → 成功生成结果，列表显示节省空间 ✅/❌
2. **目标大小**：同一图 → 目标 500KB（JPEG）→ 结果 ≤500KB（列表绿色数字核对）；重复 WEBP 输出同样达标 ✅/❌
3. **像素修改**：任意图 → 关锁比例输入 295×413 → 处理 → 下载当前 → 用下方命令核对像素严格等于 295×413 ✅/❌
4. **尺寸调整**：4032×3024 图 → 宽度 1920 保持比例 → 结果 1920×1440 ✅/❌
5. **批量处理**：一次拖入 ≥10 张（可用 fixtures BMP + 自己照片混合）→ 统一 500KB → 进度浮层 n/m 与当前文件名正确 → 完成 → 下载 ZIP 解压核对数量 ✅/❌
6. **隐私**：以上全程 DevTools Network 面板无图片数据请求（仅本地资源）✅/❌

像素核对命令（PowerShell，替换路径）：

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("D:\downloads\test_295x413.jpg")
"$($img.Width)x$($img.Height)"
$img.Dispose()
```

任一项 ❌ 则修复后重跑该项。

- [ ] **Step 5: 最终提交**

```bash
git add README.md scripts .gitignore docs
git commit -m "docs: readme, fixture generator, acceptance checklist complete"
```

---

## 计划自检记录（Self-Review）

1. **Spec 覆盖**：P0 十五项 → 上传(T10)/预览(T11,T14)/压缩质量(T12,T13)/目标大小(T4,T5,T12,T13)/尺寸(T12)/像素严格输出(T5,T12)/格式转换(T5,T12,T13)/单张下载(T13)/批量(T13)/ZIP(T13)/对比(T14)/本地处理(全局,T16 场景6)。EXIF 方向在 T5 解码层落实。
2. **占位符扫描**：Task 11 曾含占位写法，已在计划定稿前修正为直接可用的返回按钮代码；CompareViewerStub 是显式的临时桥接组件（T14 移除），非占位符。
3. **类型一致性**：`ProcessOptions/ProcessResult/ImageAsset/WorkerRequest/WorkerResponse`（T2 定义，T5/T6/T7/T8/T13 引用一致）；`solveTargetSize` 返回 `{quality,scale,fitsTarget,encodes}` 与 T5 pipeline 使用一致；`createProcessor/defaultPoolSize/ImageProcessor`（T6 定义，T13 使用一致）；`buildProcessOptions(s, original)`（T7 定义，T13 一致调用）；`resultFileName/downloadResultsZip/downloadBlob`（T13 定义与使用一致）。

