# 🎬 FlowCut — 免费AI自动视频剪辑

> 浏览器端AI视频剪辑：场景检测、光流追踪、自动字幕、一键导出。零费用、零后端、完全本地处理。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live_Demo-FlowCut-7c5cfc?style=flat)](https://dorianchn.github.io/ai-auto-editor/)

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 🔍 智能场景检测 | 帧差分自适应阈值算法，自动识别场景切换点 |
| 💬 AI自动字幕 | Whisper WASM，中/英/日/韩，三种模型大小 |
| 🎞️ 可视化时间线 | 视频+字幕双轨道，实时预览，键盘快捷键 |
| 📤 多格式导出 | 合并片段 / SRT字幕 / 烧录字幕到视频 |

## 🚀 使用

**在线** → [dorianchn.github.io/ai-auto-editor](https://dorianchn.github.io/ai-auto-editor/)

**本地开发**
```bash
git clone https://github.com/DorianChn/ai-auto-editor.git
cd ai-auto-editor
npm install
npm run dev
```

## 🛠️ 技术栈

- **React 19** + **Vite** — 前端框架
- **Whisper WASM** (HuggingFace Transformers) — 语音识别
- **FFmpeg WASM** — 视频编码导出
- **Canvas API** — 帧差分场景检测
- **块匹配光流** — 运动分析

## 📐 场景检测算法

```
视频 → 3fps提取帧 → 帧间MAD差异
   → 自适应阈值 = max(0.08, median + max(0.03, MAD×2.5))
   → 局部峰值过滤 → 最短场景合并 → 场景列表
```

## ⌨️ 快捷键

| 按键 | 功能 |
|------|------|
| `空格` | 播放/暂停 |
| `←` `→` | 快退/快进 2秒 |
| `J` `L` | 快退/快进 5秒 |
| `Home` `End` | 跳转开头/结尾 |

## 📁 结构

```
src/
├── lib/
│   ├── sceneDetector.js   # 场景检测引擎
│   ├── opticalFlow.js     # 光流追踪引擎
│   ├── asr.js             # Whisper语音识别
│   ├── timeline.js        # 时间线管理
│   └── exporter.js        # FFmpeg导出
├── components/
│   ├── Timeline.jsx       # 时间线组件
│   ├── ScenePanel.jsx     # 场景面板
│   ├── CaptionPanel.jsx   # 字幕面板
│   └── ExportPanel.jsx    # 导出面板
├── App.jsx                # 主应用 + 着陆页
├── main.jsx               # 入口
└── styles.css             # 全局样式
```

## 🙏 致谢

受 [MartinDelophy/ai-video-editor](https://github.com/MartinDelophy/ai-video-editor) 启发。

## 📄 License

MIT — 免费开源，可商用
