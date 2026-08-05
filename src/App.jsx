import React, { useState, useRef, useCallback, useEffect } from 'react';
import { extractFramesWithDiff, detectScenes, mergeShortScenes } from './lib/sceneDetector.js';
import { transcribeAudio } from './lib/asr.js';
import { mergeClips, burnSubtitles, downloadBlob, exportSubtitlesSRT } from './lib/exporter.js';
import { formatTime, formatTimeShort } from './lib/timeline.js';
import Timeline from './components/Timeline.jsx';
import ScenePanel from './components/ScenePanel.jsx';
import CaptionPanel from './components/CaptionPanel.jsx';
import ExportPanel from './components/ExportPanel.jsx';

/* ==================== Landing Page ==================== */
function Landing({ onEnter }) {
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (file && file.type.startsWith('video/')) onEnter(file);
  };

  return (
    <div className="landing">
      <div className="landing-content">
        {/* Nav */}
        <nav className="landing-nav">
          <div className="landing-logo">
            <div className="landing-logo-icon">🎬</div>
            FlowCut
          </div>
          <div className="landing-nav-links">
            <a href="https://github.com/DorianChn/ai-auto-editor" target="_blank" rel="noopener"
               style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}>
              GitHub
            </a>
            <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
              开始使用
            </button>
            <input ref={fileRef} type="file" accept="video/*" hidden
                   onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>
        </nav>

        {/* Hero */}
        <section className="hero">
          <div className="hero-badge">✨ 浏览器端 AI · 零费用 · 开源</div>
          <h1>
            <em>FlowCut</em><br />
            AI 自动视频剪辑
          </h1>
          <p className="hero-sub">
            上传视频 → AI自动检测场景、生成字幕、一键导出。<br />
            全部在浏览器本地完成，无需上传服务器，完全免费。
          </p>
          <div className="hero-actions">
            <button className="btn-hero btn-hero-primary" onClick={() => fileRef.current?.click()}>
              🎬 上传视频开始
            </button>
            <a href="https://github.com/DorianChn/ai-auto-editor" target="_blank" rel="noopener"
               className="btn-hero btn-hero-secondary" style={{ textDecoration: 'none' }}>
              ⭐ GitHub
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="features">
          <div className="feature-card">
            <div className="feature-icon feature-icon-purple">🔍</div>
            <div className="feature-title">智能场景检测</div>
            <div className="feature-desc">
              基于帧差分的自适应阈值算法，按3fps提取关键帧，计算帧间MAD差异，
              自动识别视频中的场景切换点，生成缩略图预览。
            </div>
            <span className="feature-tag tag-local">本地计算</span>
          </div>
          <div className="feature-card">
            <div className="feature-icon feature-icon-blue">💬</div>
            <div className="feature-title">AI 自动字幕</div>
            <div className="feature-desc">
              使用 Whisper WASM 语音识别模型，在浏览器中直接转写语音为字幕。
              支持中/英/日/韩，三种模型大小可选，字幕可编辑。
            </div>
            <span className="feature-tag tag-free">完全免费</span>
          </div>
          <div className="feature-card">
            <div className="feature-icon feature-icon-green">🎞️</div>
            <div className="feature-title">可视化时间线</div>
            <div className="feature-desc">
              视频轨道和字幕轨道同步显示，点击场景/字幕跳转预览，
              支持键盘快捷键控制播放，实时字幕覆盖层。
            </div>
            <span className="feature-tag tag-fast">实时预览</span>
          </div>
          <div className="feature-card">
            <div className="feature-icon feature-icon-yellow">📤</div>
            <div className="feature-title">多格式导出</div>
            <div className="feature-desc">
              合并场景片段导出剪辑、导出SRT字幕文件、
              烧录字幕到视频画面。使用 FFmpeg WASM 浏览器端编码。
            </div>
            <span className="feature-tag tag-local">本地编码</span>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="tech-section">
          <div className="tech-title">技术栈</div>
          <div className="tech-grid">
            <div className="tech-item"><span>⚛️</span> React 19</div>
            <div className="tech-item"><span>⚡</span> Vite</div>
            <div className="tech-item"><span>🧠</span> Whisper WASM</div>
            <div className="tech-item"><span>🎬</span> FFmpeg WASM</div>
            <div className="tech-item"><span>🌊</span> 光流追踪</div>
            <div className="tech-item"><span>📐</span> 自适应阈值</div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <p>
            FlowCut — 免费开源 AI 视频剪辑 · MIT License ·{' '}
            <a href="https://github.com/DorianChn/ai-auto-editor" target="_blank" rel="noopener">GitHub</a>
          </p>
          <p style={{ marginTop: 8, fontSize: 11 }}>
            受 <a href="https://github.com/MartinDelophy/ai-video-editor" target="_blank" rel="noopener">Timeline Studio</a> 启发
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ==================== Editor ==================== */
export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [scenes, setScenes] = useState([]);
  const [captions, setCaptions] = useState([]);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [selectedCaptionId, setSelectedCaptionId] = useState(null);

  const [sceneDetection, setSceneDetection] = useState({ status: 'idle', progress: 0, phase: '' });
  const [captionGen, setCaptionGen] = useState({ status: 'idle', progress: 0, phase: '' });
  const [exporting, setExporting] = useState({ status: 'idle', progress: 0, phase: '' });

  const [activeTab, setActiveTab] = useState('scenes');
  const [toasts, setToasts] = useState([]);
  const [asrModel, setAsrModel] = useState('tiny');
  const [asrLanguage, setAsrLanguage] = useState('zh');

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastId = useRef(0);

  const notify = useCallback((message, type = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // File handling
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('video/')) {
      notify('请选择视频文件', 'error');
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setScenes([]);
    setCaptions([]);
    setSceneDetection({ status: 'idle', progress: 0, phase: '' });
    setCaptionGen({ status: 'idle', progress: 0, phase: '' });
    notify(`已加载: ${file.name}`, 'success');
  }, [videoUrl, notify]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Video events
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const seekTo = useCallback((time) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(Math.max(0, currentTime - 2)); }
      if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(Math.min(duration, currentTime + 2)); }
      if (e.code === 'KeyJ') { e.preventDefault(); seekTo(Math.max(0, currentTime - 5)); }
      if (e.code === 'KeyL') { e.preventDefault(); seekTo(Math.min(duration, currentTime + 5)); }
      if (e.code === 'Home') { e.preventDefault(); seekTo(0); }
      if (e.code === 'End') { e.preventDefault(); seekTo(duration); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, seekTo, currentTime, duration]);

  // Scene Detection
  const runSceneDetection = useCallback(async () => {
    if (!videoRef.current || sceneDetection.status === 'running') return;
    setSceneDetection({ status: 'running', progress: 0, phase: '提取帧...' });
    notify('开始场景检测...', 'info');
    try {
      const video = videoRef.current;
      const wasPlaying = !video.paused;
      if (wasPlaying) video.pause();

      const frames = await extractFramesWithDiff(video, {
        fps: 3,
        onProgress: ({ current, total }) => {
          setSceneDetection({
            status: 'running',
            progress: Math.round((current / total) * 60),
            phase: `提取帧 ${current}/${total}`,
          });
        },
      });

      setSceneDetection((s) => ({ ...s, progress: 70, phase: '分析场景切换...' }));
      let detectedScenes = detectScenes(frames, { minGap: Math.max(0.5, duration / 100) });
      detectedScenes = mergeShortScenes(detectedScenes, 0.3);

      setScenes(detectedScenes);
      setSceneDetection({ status: 'done', progress: 100, phase: `检测到 ${detectedScenes.length} 个场景` });
      notify(`场景检测完成: ${detectedScenes.length} 个场景`, 'success');
      if (wasPlaying) video.play();
    } catch (err) {
      setSceneDetection({ status: 'error', progress: 0, phase: err.message });
      notify(`场景检测失败: ${err.message}`, 'error');
    }
  }, [videoRef, duration, sceneDetection.status, notify]);

  // Auto Captions
  const runAutoCaptions = useCallback(async () => {
    if (!videoFile || captionGen.status === 'running') return;
    setCaptionGen({ status: 'running', progress: 0, phase: '准备音频...' });
    notify('开始生成字幕...', 'info');
    try {
      const result = await transcribeAudio(videoFile, {
        language: asrLanguage,
        modelSize: asrModel,
        onProgress: ({ phase, progress }) => setCaptionGen({ status: 'running', progress, phase }),
      });
      setCaptions(result.segments);
      setCaptionGen({ status: 'done', progress: 100, phase: `生成 ${result.segments.length} 条字幕` });
      notify(`字幕生成完成: ${result.segments.length} 条`, 'success');
    } catch (err) {
      setCaptionGen({ status: 'error', progress: 0, phase: err.message });
      notify(`字幕生成失败: ${err.message}`, 'error');
    }
  }, [videoFile, asrLanguage, asrModel, captionGen.status, notify]);

  // Export
  const handleExport = useCallback(async (type) => {
    if (!videoFile || exporting.status === 'running') return;
    setExporting({ status: 'running', progress: 0, phase: '准备导出...' });
    try {
      if (type === 'clips') {
        const clips = scenes.map((s) => ({ start: s.start, end: s.end }));
        if (!clips.length) { notify('没有场景可导出', 'error'); return; }
        const blob = await mergeClips(videoFile, clips, {
          onProgress: ({ phase, progress }) => setExporting({ status: 'running', progress, phase }),
        });
        downloadBlob(blob, `flowcut_${videoFile.name}`);
      } else if (type === 'subtitles') {
        if (!captions.length) { notify('没有字幕可导出', 'error'); return; }
        exportSubtitlesSRT(captions);
      } else if (type === 'burned') {
        if (!captions.length) { notify('没有字幕可烧录', 'error'); return; }
        const blob = await burnSubtitles(videoFile, captions, {
          onProgress: ({ phase, progress }) => setExporting({ status: 'running', progress, phase }),
        });
        downloadBlob(blob, `flowcut_subtitled_${videoFile.name}`);
      }
      setExporting({ status: 'done', progress: 100, phase: '导出完成' });
      notify('导出完成!', 'success');
    } catch (err) {
      setExporting({ status: 'error', progress: 0, phase: err.message });
      notify(`导出失败: ${err.message}`, 'error');
    }
  }, [videoFile, scenes, captions, exporting.status, notify]);

  const handleSceneSelect = useCallback((scene) => {
    setSelectedSceneId(scene.id);
    seekTo(scene.start);
  }, [seekTo]);

  const handleCaptionSelect = useCallback((cap) => {
    setSelectedCaptionId(cap.id);
    seekTo(cap.start);
  }, [seekTo]);

  // Return to landing
  const handleLogoClick = useCallback(() => {
    if (videoFile) {
      if (videoRef.current) videoRef.current.pause();
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoFile(null);
      setVideoUrl(null);
      setScenes([]);
      setCaptions([]);
    }
  }, [videoFile, videoUrl]);

  const tracks = {
    visual: scenes.map((s) => ({
      id: s.id, type: 'video', start: s.start, end: s.end,
      label: `S${s.index + 1}`, keyFrame: s.keyFrame,
    })),
    caption: captions.map((c) => ({
      id: c.id, type: 'caption', start: c.start, end: c.end, text: c.text,
    })),
  };

  // ==================== Render ====================

  // Landing page
  if (!videoFile) {
    return <Landing onEnter={handleFile} />;
  }

  // Editor
  return (
    <div className="app">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-logo" onClick={handleLogoClick}>
          <div className="topbar-logo-icon">🎬</div>
          FlowCut
        </div>
        <div className="topbar-center">
          <span>{videoFile.name}</span>
          {duration > 0 && <span>· {formatTimeShort(duration)}</span>}
        </div>
        <div className="topbar-actions">
          <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>
            📂 换视频
          </button>
          <input ref={fileInputRef} type="file" accept="video/*" hidden
                 onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="workspace">
        {/* Sidebar */}
        <div className="sidebar">
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'scenes', icon: '🎞️', label: '场景' },
              { id: 'captions', icon: '💬', label: '字幕' },
              { id: 'export', icon: '📤', label: '导出' },
            ].map((tab) => (
              <button key={tab.id}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                  background: 'transparent', fontSize: 12, fontWeight: 600,
                  color: activeTab === tab.id ? 'var(--accent-light)' : 'var(--text-dim)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'scenes' && (
            <ScenePanel
              scenes={scenes} selectedSceneId={selectedSceneId}
              onSceneSelect={handleSceneSelect} detection={sceneDetection}
              onDetect={runSceneDetection}
              onDeleteScene={(id) => setScenes((prev) => prev.filter((s) => s.id !== id))}
            />
          )}
          {activeTab === 'captions' && (
            <CaptionPanel
              captions={captions} selectedCaptionId={selectedCaptionId}
              onCaptionSelect={handleCaptionSelect} generation={captionGen}
              onGenerate={runAutoCaptions} asrModel={asrModel} setAsrModel={setAsrModel}
              asrLanguage={asrLanguage} setAsrLanguage={setAsrLanguage}
              onUpdateCaption={(id, text) => setCaptions((p) => p.map((c) => c.id === id ? { ...c, text } : c))}
              onDeleteCaption={(id) => setCaptions((p) => p.filter((c) => c.id !== id))}
            />
          )}
          {activeTab === 'export' && (
            <ExportPanel
              scenes={scenes} captions={captions} exporting={exporting}
              onExport={handleExport} duration={duration}
            />
          )}
        </div>

        {/* Main area */}
        <div className="main-area">
          <div className="preview-container" onClick={togglePlay}>
            <video ref={videoRef} src={videoUrl} style={{ cursor: 'pointer' }}
              onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)} />
            {/* Caption overlay */}
            {captions.filter((c) => currentTime >= c.start && currentTime <= c.end).map((c) => (
              <div key={c.id} style={{
                position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.8)', color: 'white', padding: '6px 18px',
                borderRadius: 8, fontSize: 15, pointerEvents: 'none',
                backdropFilter: 'blur(6px)', maxWidth: '80%', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                {c.text}
              </div>
            ))}
            <div className="preview-overlay">
              <button className="btn-icon" style={{ color: 'white', fontSize: 16 }}
                      onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span className="preview-time">
                {formatTimeShort(currentTime)} / {formatTimeShort(duration)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>
                <kbd className="kbd">空格</kbd> 播放
                <kbd className="kbd" style={{ marginLeft: 6 }}>←→</kbd> 快进
              </span>
            </div>
          </div>

          <Timeline
            tracks={tracks} duration={duration} currentTime={currentTime}
            onSeek={seekTo} selectedSceneId={selectedSceneId}
            selectedCaptionId={selectedCaptionId}
          />
        </div>
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
