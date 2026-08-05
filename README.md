# 🎬 AI Auto Editor — 免费AI自动视频剪辑

> 基于浏览器端AI的自动视频剪辑工具，零费用、零后端、完全本地处理

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-blue)](https://dorianchn.github.io/ai-auto-editor/)

## ✨ 功能特性

### 🔍 一键场景检测
- 基于帧差分的自适应阈值场景分割
- 按3fps提取关键帧，计算帧间MAD（平均绝对偏差）
- 自适应阈值 = 中位数 + 2.5×MAD（鲁棒性强）
- 局部峰值过滤 + 最短场景合并
- 自动生成场景缩略图

### 💬 AI自动字幕
- 使用 Whisper WASM（HuggingFace Transformers）
- 支持中文、英文、日文、韩文
- 三种模型大小可选：Tiny（最快）/ Base（平衡）/ Small（最准）
- 完全在浏览器端运行，无需API Key
- 字幕可编辑、可删除

### 🎞️ 时间线编辑器
- 可视化时间线，支持视频轨道和字幕轨道
- 点击场景/字幕跳转到对应时间点
- 实时播放头跟踪
- 键盘快捷键：空格（播放/暂停）、←→（快进/快退）

### 📤 多格式导出
- **导出剪辑片段**：合并选中场景为完整视频
- **导出字幕文件**：SRT 格式，兼容所有播放器
- **烧录字幕**：将字幕硬编码到视频画面
- 使用 FFmpeg WASM 浏览器端编码

## 🚀 快速开始

### 在线使用
直接访问 [GitHub Pages 演示](https://dorianchn.github.io/ai-auto-editor/)

### 本地开发
```bash
# 克隆仓库
git clone https://github.com/DorianChn/ai-auto-editor.git
cd ai-auto-editor

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 🛠️ 技术栈

| 模块 | 技术 |
|------|------|
| 前端框架 | React 19 + Vite |
| 场景检测 | Canvas API + 自适应帧差分算法 |
| 语音识别 | Whisper WASM (HuggingFace Transformers) |
| 视频处理 | FFmpeg WASM |
| 样式 | 纯 CSS（暗色主题） |

## 📐 算法详解

### 场景检测流程
```
视频 → 按3fps提取帧 → 计算帧间MAD差异
     → 自适应阈值（中位数+2.5×MAD）
     → 局部峰值过滤 → 最短场景合并 → 场景列表
```

### 自适应阈值公式
```javascript
threshold = max(floor, median + max(0.03, MAD * 2.5))
```
- `median`：所有帧差分值的中位数
- `MAD`：帧差分值的中位数绝对偏差
- `floor`：最小阈值（默认0.08）

这种方法比固定阈值更鲁棒，能适应不同视频的内容特征。

## 📁 项目结构

```
ai-auto-editor/
├── src/
│   ├── lib/
│   │   ├── sceneDetector.js   # 场景检测引擎
│   │   ├── opticalFlow.js     # 光流追踪引擎
│   │   ├── asr.js             # 语音识别模块
│   │   ├── timeline.js        # 时间线管理
│   │   └── exporter.js        # 视频导出模块
│   ├── components/
│   │   ├── Timeline.jsx       # 时间线组件
│   │   ├── ScenePanel.jsx     # 场景面板
│   │   ├── CaptionPanel.jsx   # 字幕面板
│   │   └── ExportPanel.jsx    # 导出面板
│   ├── App.jsx                # 主应用
│   ├── main.jsx               # 入口
│   └── styles.css             # 全局样式
├── index.html
├── package.json
└── vite.config.js
```

## 🙏 致谢

本项目受 [MartinDelophy/ai-video-editor](https://github.com/MartinDelophy/ai-video-editor) 启发，在其场景检测和自动字幕的核心思路上进行了重写和增强。

## 📄 License

MIT — 免费开源，可商用
