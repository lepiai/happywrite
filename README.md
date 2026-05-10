# lepiai/happywrite 仓库介绍与安装指南
## 一、项目介绍
**lepiai/happywrite** 是基于 **Electron + Vite + TypeScript** 开发的**AI自媒体编辑器**，定位为桌面端AI内容创作工具，用于自媒体文案生成、编辑、排版与导出，适合公众号、小红书、短视频文案等场景快速产出。

### 核心技术栈
- 主框架：Electron（跨平台桌面）
- 构建工具：Vite
- 开发语言：TypeScript
- 样式：Tailwind CSS
- 规范：ESLint

### 目录结构说明
- src：前端渲染层源码
- out：构建输出目录
- electron.*.js/ts：Electron主进程相关
- vite.*.config.ts：Vite多环境配置
- package.json：依赖与脚本入口

---
## 二、安装与运行步骤
### 1. 环境准备
- Node.js ≥ 16.x
- npm 或 yarn
- Git

### 2. 克隆代码
```bash
git clone https://github.com/lepiai/happywrite.git
cd happywrite
```

### 3. 安装依赖
```bash
npm install
# 或 yarn install
```

### 4. 环境配置
复制并配置环境变量文件：
```bash
cp .env.example .env
# 按需求编辑 .env
```

### 5. 开发模式启动
```bash
npm run dev
# 或 npm run start:electron
```

### 6. 打包构建
```bash
# 构建对应平台安装包
npm run build
```
Windows 可直接运行 `start.bat` 快速启动。

