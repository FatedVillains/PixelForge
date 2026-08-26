# Tauri v2 Windows 客户端设计（v1 附加）

日期：2026-08-26
状态：已确认

## 目标
为小王修图 PixelForge 提供 Windows 桌面客户端：NSIS 安装包 + 绿色便携 exe 双产物，前端代码零改动。

## 决策
- 方案：Tauri v2（Rust 壳 + 系统 WebView2），PRD 第三十节预留方向
- 嵌入产物：dist-single/（单文件构建），CSP 放行内联脚本与 blob: worker
- 窗口：1200×800，最小 960×600，标题「小王修图 PixelForge」，居中启动
- 权限模型：v1 不启用任何原生插件/权限，保持纯本地隐私模型；原生增强（另存为、文件关联、自动更新）留待后续版本
- 图标：scripts/make-icons.mjs 用 @resvg/resvg-js 将 favicon.svg 渲染为 1024px PNG，再由 tauri icon 生成全套格式
- 标识：identifier com.xiaowangxiutu.app；productName 小王修图（若构建工具链对非 ASCII 敏感则回退 XiaoWangXiuTu 并记录）

## 结构
src-tauri/{Cargo.toml, build.rs, tauri.conf.json, src/main.rs, icons/, capabilities/default.json}
scripts/make-icons.mjs
package.json 增加 devDep @tauri-apps/cli 与脚本 tauri / tauri:build

## 验收
1. tauri build 成功产出 src-tauri/target/release/*.exe 与 bundle/nsis/*-setup.exe
2. 绿色 exe 启动进程存活冒烟（GUI 细节验收由用户完成）
3. 应用内可完整执行一张图片的压缩流程（用户人工）
4. 常规 Web 构建不受影响（pnpm build / build:single 全绿）

## 环境投入（一次性）
rustup（x86_64-pc-windows-msvc）+ Visual Studio 2022 Build Tools C++ 工作负载；NSIS 由 Tauri 自动下载。
