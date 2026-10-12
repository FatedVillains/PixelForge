# 小王修图 PixelForge

> 让每一张图片，都刚刚好。

本地图片压缩与处理工具：图片默认在你的设备上处理，不上传任何服务器。

## 使用方式

### 浏览器版（Web）

- **开箱即用**：`pnpm dev` 启动开发服务器，或 `pnpm build` 后用任意静态服务器托管 `dist/`
- **完全离线单文件版**：`pnpm build:single` → 直接双击 `dist-single/index.html` 即可使用，无需服务器

### Windows 桌面客户端（Tauri v2）

- **绿色版**：`src-tauri/target/release/xiaowangxiutu.exe`，解压即用，无需安装
- **安装包**：`src-tauri/target/release/bundle/nsis/小王修图_*_x64-setup.exe`，双击安装，支持开始菜单/桌面快捷方式/卸载
- 界面与功能与 Web 版完全一致，复用同一套前端代码（WebView2 渲染，Windows 10/11 自带运行时）

## 功能（v1 / P0）

- 上传：点击选择 / 拖拽 / Ctrl+V 粘贴
- 压缩：按质量（1–100%）或按目标文件大小（二分搜索最优质量，15 秒时间预算）
- 尺寸调整：锁定比例、快捷尺寸
- 像素修改：严格输出目标像素（如证件照 295×413）
- 格式转换：JPG / PNG / WEBP
- 批量处理 + ZIP 打包导出（流式打包）
- 原图/处理后 滑块 & 并排对比
- 专业高清放大：Lanczos/Bicubic/… 放大、2K–16K 输出、降噪/锐化/边缘增强、超大图自动分块
- 大图保护、单张失败隔离、全程本地隐私

## 资源与安全边界

| 项目 | 上限 | 位置 |
| --- | --- | --- |
| 源文件体积 | 50 MB | `src/core/guard.ts` |
| 源图像素 | 4000 万 | `src/core/guard.ts` |
| 压缩模式输出 | 6400 万像素 / 单边 20000px（无分块） | `src/core/guard.ts` |
| 放大模式输出 | 单边 64000px（超阈值自动分块，内存预估超 6GB 拒绝） | `src/core/upscale/` |
| ZIP 打包总量 | 2 GB | `src/utils/zip.ts` |

桌面客户端的 `fs:allow-write-file` scope 限定在用户数据目录（`$HOME` / 桌面 / 文档 / 下载 / 图片 / 临时），
并显式拒绝 `~/.ssh`、`~/.aws`、`~/.config`、`~/.gnupg`。保存到其他盘符会被拒绝并给出提示——
这是有意为之的最小权限取舍，见 `src-tauri/capabilities/default.json`。

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm test       # Vitest 单测
pnpm typecheck  # vue-tsc（含 noUnusedLocals / noUnusedParameters）
pnpm check      # typecheck + test
pnpm build      # 生产构建（多文件 → dist/）
pnpm build:single   # 完全离线单文件构建（→ dist-single/，含类型检查）
pnpm tauri build    # 桌面客户端构建（NSIS 安装包 + 绿色版 exe）
pnpm fixtures   # 生成 BMP 测试夹具到 fixtures/
```

桌面客户端构建需要本机具备 Rust 工具链与 MSVC C++ 工作负载（首次构建会编译约 400 个 Rust 依赖，后续增量构建很快）。

## 架构

- `src/core/` 平台无关处理核心（类型/嗅探/几何/守卫/求解器/管线），零 Vue 依赖
- `src/workers/` Web Worker 入口与调度池（主线程回退）
- `src/stores/` 设置与图片库状态
- `src/views/`+`src/components/` UI 层（Tailwind v4，自绘组件）
- `src-tauri/` 桌面客户端（Tauri v2）：嵌入 `dist-single/` 单文件产物，零前端改动

详细设计见 `docs/superpowers/specs/`。
