# 小王修图 PixelForge

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
