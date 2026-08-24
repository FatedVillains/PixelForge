# 像素匠 PixelForge — v1 设计文档

日期：2026-08-24
状态：已与用户确认

## 1. 背景与目标

像素匠 PixelForge 是一款**纯本地处理**的图片压缩与处理工具，解决图片过大、尺寸不符、像素不合规等问题。产品定位：简单、快速、专业的本地图片工具箱。

**本版（v1）范围：仅 PRD P0 功能**，即：

1. 图片上传（点击 / 拖拽 / Ctrl+V 粘贴）
2. JPG / PNG / WEBP 支持（BMP 解码浏览器原生支持，输入免费获得）
3. 图片预览
4. 图片压缩（按质量 / 按目标文件大小）
5. 图片尺寸调整（锁定比例 / 快捷尺寸）
6. 像素调整（严格输出目标像素，如证件照 295×413）
7. 图片格式转换（JPG / PNG / WEBP）
8. 单张下载
9. 批量处理 + 批量下载 ZIP
10. 原图 / 处理后对比（左右 + 滑块）
11. 全程本地浏览器处理，无网络上传

P1/P2（清晰度增强、裁剪、EXIF 清理、撤销重做、AI 功能等）不在本版范围内，但架构需预留扩展点。

## 2. 已确认的决策

| 决策项 | 结论 |
|---|---|
| v1 范围 | 仅 P0 |
| 技术栈 | Vue 3 + TypeScript + Vite |
| UI 方案 | Tailwind CSS + 自绘组件（Linear/macOS 风格、蓝紫主色） |
| 界面语言 | 中文为主，文案集中管理便于后续 i18n |
| 处理架构 | Web Worker 池 + OffscreenCanvas（方案 B），核心纯 TS 与 UI 解耦 |
| 跨端预留 | 核心逻辑平台无关；未来桌面端用 Tauri、移动端用 Capacitor 复用同一核心 |
| 包管理器 | pnpm |

## 3. 总体架构

### 3.1 目录结构

```
src/
├── core/                  # 平台无关纯 TS，零 Vue/DOM 依赖
│   ├── types.ts               # ProcessOptions / ProcessResult / ImageAsset 类型
│   ├── pipeline.ts            # ImageProcessor 管线编排：解码→变换→编码→Blob
│   ├── processors/
│   │   ├── resize.ts          # 高质量缩放（大倍率多步降采样）
│   │   ├── compress.ts        # 质量模式编码
│   │   └── target-size.ts     # 目标大小二分求解器
│   ├── codec.ts               # createImageBitmap 解码 + OffscreenCanvas/Canvas 编码封装
│   ├── sniff.ts               # 文件魔数嗅探（识别真实格式）
│   └── guard.ts               # 大图保护阈值判断
├── workers/
│   ├── process.worker.ts      # Worker 入口：收消息→跑管线→回传
│   └── pool.ts                # Worker 池调度（主线程侧）
├── stores/
│   ├── images.ts              # Pinia：图片资产列表、状态机、结果数据
│   └── settings.ts            # Pinia：处理参数设置
├── composables/
│   ├── useFileImport.ts       # 点击/拖拽/粘贴统一接入入口
│   └── usePaste.ts            # 全局粘贴监听
├── components/
│   ├── upload/Dropzone.vue
│   ├── list/ImageList.vue / ImageCard.vue
│   ├── preview/CompareViewer.vue      # 左右对比 + 滑块对比
│   ├── settings/SettingsPanel.vue     # 及其子面板
│   ├── batch/ProgressOverlay.vue
│   ├── results/ResultStats.vue
│   ├── common/ConfirmDialog.vue / ErrorToast.vue
│   └── ui/                    # Button / Card / Slider / Select / Switch 等基础组件
├── views/
│   ├── HomeView.vue           # 首页
│   └── WorkspaceView.vue      # 三栏工作台
├── utils/
│   ├── format.ts              # 字节数等格式化
│   ├── naming.ts              # 导出文件命名规则
│   └── download.ts            # 单张下载 / ZIP 打包下载（fflate）
├── App.vue
└── main.ts
```

不引入 vue-router（v1 用视图状态切换首页/工作台）。

### 3.2 运行时分层

- **主线程**：UI 渲染、文件接入校验、缩略图生成、任务编排、进度展示
- **Worker 池**：全部重活（解码、缩放、编码、目标大小迭代）。池大小 = `min(4, max(2, hardwareConcurrency - 1))`
- **降级策略**：不支持 Worker + OffscreenCanvas 的环境回退主线程执行同一条管线（管线本身不依赖 Worker）

## 4. 处理核心设计

### 4.1 参数模型

```ts
interface ProcessOptions {
  outputFormat: 'jpeg' | 'png' | 'webp'
  mode: 'quality' | 'targetSize'
  quality?: number              // 1–100，质量模式用（jpeg/webp 有效）
  targetSizeBytes?: number      // 目标大小模式用
  resize?: {
    width: number
    height: number
    keepAspectRatio: boolean    // 锁定时以宽度为准推算高度
  }
}
```

扩展新能力（裁剪、旋转、锐化等）只增字段不改结构。

### 4.2 管线流程（每张图）

```
ArrayBuffer
 → 解码：createImageBitmap(blob, { imageOrientation: 'from-image' })
   （手机竖拍照片自动转正，重编码后方向正确）
 → 尺寸变换：OffscreenCanvas 绘制到目标尺寸
   （imageSmoothingQuality:'high'；缩小倍率 >2 时分步降采样保证画质）
 → 编码：
   ├ 质量模式：指定 quality 编码一次（PNG 忽略 quality）
   └ 目标大小模式：quality 二分搜索（≤7 轮），
     取「不超过目标大小的最高质量」；
     若最低质量仍超标 → 尺寸逐级 ×0.85 缩小后重新搜索，
     直到达标或达到下限（报告实际结果）
 → 输出 ProcessResult { blob, width, height, size, format, iterations }
```

关键约束：

- **严格像素输出**：设置 resize 时输出画布尺寸必须精确等于目标值
- **内存控制**：ImageBitmap 用完立即 `close()`；ArrayBuffer 以 Transferable 零拷贝传入 Worker；预览 Blob URL 按需创建并及时 revoke
- **Worker 协议**：
  - 主→Worker：`{ type:'process', jobId, buffer(transfer), mime, options }`
  - Worker→主：`{ type:'progress'|'done'|'error', jobId, ... }`

### 4.3 格式支持

- 输入：JPG / JPEG / PNG / WEBP / BMP（魔数嗅探验证，拒绝无法解码的文件并说明原因）
- 输出：JPEG / PNG / WEBP（浏览器原生 canvas 编码）
- **PNG 为无损格式**：「按目标大小」模式仅对 JPEG / WEBP 输出生效；用户选择 PNG + 目标大小时，UI 提示该组合不适用（PNG 只能通过缩小尺寸减小体积），并禁用质量相关控件

## 5. UI 设计

### 5.1 首页 HomeView

- 顶部品牌栏：像素匠 PixelForge · 副标题「图片压缩 · 尺寸调整 · 像素修改 · 清晰度优化」· 关于入口
- 居中主标题 + 隐私提示：「🔒 图片默认在您的设备本地处理，不上传服务器」
- 大拖拽区：拖入 / 点击选择 / Ctrl+V 粘贴三种方式（全局监听 paste 事件）
- 支持格式说明：JPG / PNG / WEBP / BMP
- 快速操作卡片：图片压缩 / 尺寸调整 / 像素修改 / 格式转换（点击进入工作台并预选对应设置焦点）

视觉风格：大面积留白、圆角卡片、轻量动效、蓝紫色系主色、不过度渐变。

### 5.2 工作台 WorkspaceView（三栏）

```
左：图片列表          中：预览区              右：参数面板
┌──────────┬─────────────────────┬──────────────┐
│ 缩略图    │                     │ 输出格式      │
│ 文件名    │   选中图大图预览      │ JPG/PNG/WEBP │
│ 原始信息  │                     │ 质量/目标大小 │
│ 状态标记  │   处理完成后:        │ 尺寸调整      │
│ 删除/清空 │   左右对比/滑块对比   │ 宽×高/锁比例  │
│ 继续添加  │                     │ 快捷尺寸/预设 │
│          │                     │ [开始处理]    │
└──────────┴─────────────────────┴──────────────┘
```

右侧参数面板内容：

1. **输出格式**：JPG / PNG / WEBP；质量模式下显示质量滑杆（默认 80%）
2. **压缩模式**：按质量 ｜ 按目标大小（快捷档 100K/200K/300K/500K/1M/2M + 自定义输入）
3. **尺寸调整**开关：宽×高输入、锁定比例（默认开）、快捷尺寸（640×480 … 3840×2160）、证件照预设（一寸 295×413、二寸 413×579、自定义）
4. **导出选项**：自动添加处理后缀开关（`_compressed` 或 `_1920x1080`）

### 5.3 状态与反馈

每张图状态机：`待处理 → 处理中 → 已完成 ｜ 失败(含原因)`。

- 批量进度浮层：`n/m`、当前文件名、进度条；完成显示 成功 x / 失败 y 汇总
- 结果信息：前后大小、尺寸、格式、压缩率、节省空间
- 所有耗时操作必须有进行中状态，禁止静默无响应

### 5.4 对比预览

处理完成后选中图片可切换：单图查看 / 左右并排 / 滑块对比（可拖动分割线）。

## 6. 数据流

```
useFileImport（File → 魔数嗅探 → 缩略图 → 入库）
  → images store（资产列表 + 状态机）
  → 用户调参（settings store）
  → [开始处理] → 任务队列提交 Worker 池并行执行
  → 逐张回写结果/失败原因 → UI 响应式更新
  → 单张下载 / fflate 打包 pixel-forge-result.zip
```

导出命名：默认 `原名_compressed.ext`；开启尺寸后缀时 `原名_1920x1080.ext`；重名自动追加序号。

## 7. 错误处理与大图保护

- **大图保护**：像素总数 > 40MP 或单文件 > 50MB 时弹确认对话框（继续处理 / 取消），逐张判定
- **单张容错**：解码失败、编码失败、Worker 异常只标记该图为失败并显示可读原因（格式不支持/图片损坏/内存不足/目标大小无法达成），不影响其他图片与页面
- **全局兜底**：worker `onerror` 与 `unhandledrejection` 捕获，转为错误提示条
- **隐私硬约束**：全应用无任何网络请求上传图片数据；验收时通过 DevTools Network 面板确认

## 8. 测试策略

- **Vitest 单测**（core 层为主，Node 环境可跑）：
  - target-size 求解器：mock 编码器验证二分收敛、「不超过目标取最高质量」语义、极端情况降级路径
  - 锁定比例宽高换算数学
  - 魔数嗅探（JPG/PNG/WEBP/BMP 样例字节）
  - 字节格式化、导出命名规则
- **手动验收**：PRD 第三十八节六大场景
  1. 5MB JPG + 质量 80% → 成功压缩
  2. 5MB JPG + 目标 ≤500KB → 输出 ≤500KB 且画质尽量高
  3. 4032×3024 → 295×413 严格像素
  4. 4032×3024 宽度 1920 锁比例 → 1920×1440
  5. 批量多张 → ≤500KB → ZIP 下载
  6. 全程无网络请求

## 9. 依赖清单

运行时：`vue`、`pinia`、`tailwindcss`、`fflate`
开发：`typescript`、`vite`、`@vitejs/plugin-vue`、`vitest`、`vue-tsc`

## 10. 非目标（明确不做）

- AI 高清修复 / 抠图 / 老照片修复（P2，未来独立模块）
- 裁剪、旋转翻转、EXIF 清理、批量重命名、撤销重做（P1）
- 云端处理、账号系统、处理历史持久化
- GIF/AVIF/TIFF 输出
