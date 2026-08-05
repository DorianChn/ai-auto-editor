import React, { useState, useRef, useCallback, useEffect } from 'react';
import { extractFramesWithDiff, detectScenes, mergeShortScenes } from './lib/sceneDetector.js';
import { transcribeAudio } from './lib/asr.js';
import { mergeClips, burnSubtitles, downloadBlob, exportSubtitlesSRT } from './lib/exporter.js';
import { formatTime, formatTimeShort, getTotalDuration } from './lib/timeline.js';
import Timeline from './components/Timeline.jsx';
import ScenePanel from './components/ScenePanel.jsx';
import CaptionPanel from './components/CaptionPanel.jsx';
import ExportPanel from './components/ExportPanel.jsx';

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

  // 视频加载
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

  // 拖拽上传
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove('dragover');
  }, []);

  // 视频元数据
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // 播放时间更新
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // 播放/暂停
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

  // 跳转
  const seekTo = useCallback((time) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(Math.max(0, currentTime - 2)); }
      if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(Math.min(duration, currentTime + 2)); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, seekTo, currentTime, duration]);

  // ========== 场景检测 ==========
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

  // ========== 自动字幕 ==========
  const runAutoCaptions = useCallback(async () => {
    if (!videoFile || captionGen.status === 'running') return;

    setCaptionGen({ status: 'running', progress: 0, phase: '准备音频...' });
    notify('开始生成字幕...', 'info');

    try {
      const result = await transcribeAudio(videoFile, {
        language: asrLanguage,
        modelSize: asrModel,
        onProgress: ({ phase, progress }) => {
          setCaptionGen({ status: 'running', progress, phase });
        },
      });

      setCaptions(result.segments);
      setCaptionGen({ status: 'done', progress: 100, phase: `生成 ${result.segments.length} 条字幕` });
      notify(`字幕生成完成: ${result.segments.length} 条`, 'success');
    } catch (err) {
      setCaptionGen({ status: 'error', progress: 0, phase: err.message });
      notify(`字幕生成失败: ${err.message}`, 'error');
    }
  }, [videoFile, asrLanguage, asrModel, captionGen.status, notify]);

  // ========== 导出 ==========
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
        downloadBlob(blob, `edited_${videoFile.name}`);
      } else if (type === 'subtitles') {
        if (!captions.length) { notify('没有字幕可导出', 'error'); return; }
        exportSubtitlesSRT(captions);
      } else if (type === 'burned') {
        if (!captions.length) { notify('没有字幕可烧录', 'error'); return; }
        const blob = await burnSubtitles(videoFile, captions, {
          onProgress: ({ phase, progress }) => setExporting({ status: 'running', progress, phase }),
        });
        downloadBlob(blob, `subtitled_${videoFile.name}`);
      }

      setExporting({ status: 'done', progress: 100, phase: '导出完成' });
      notify('导出完成!', 'success');
    } catch (err) {
      setExporting({ status: 'error', progress: 0, phase: err.message });
      notify(`导出失败: ${err.message}`, 'error');
    }
  }, [videoFile, scenes, captions, exporting.status, notify]);

  // 场景选择时跳转
  const handleSceneSelect = useCallback((scene) => {
    setSelectedSceneId(scene.id);
    seekTo(scene.start);
  }, [seekTo]);

  // 字幕选择时跳转
  const handleCaptionSelect = useCallback((cap) => {
    setSelectedCaptionId(cap.id);
    seekTo(cap.start);
  }, [seekTo]);

  const tracks = {
    visual: scenes.map((s) => ({
      id: s.id,
      type: 'video',
      start: s.start,
      end: s.end,
      label: `S${s.index + 1}`,
      keyFrame: s.keyFrame,
    })),
    caption: captions.map((c) => ({
      id: c.id,
      type: 'caption',
      start: c.start,
      end: c.end,
      text: c.text,
    })),
  };

  // ========== 渲染 ==========
  if (!videoFile) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="topbar-logo">
            <span>🎬</span>
            AI Auto Editor
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            免费开源 · 浏览器端AI处理 · 零费用
          </div>
        </div>
        <div
          className="upload-zone"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="upload-icon">🎬</div>
          <div className="upload-text">拖拽视频到此处，或点击选择文件</div>
          <div className="upload-hint">支持 MP4、WebM、MOV 等格式 · 所有处理在浏览器本地完成</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* 顶栏 */}
      <div className="topbar">
        <div className="topbar-logo">
          <span>🎬</span>
          AI Auto Editor
        </div>
        <div className="topbar-actions">
          <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>
            📂 更换视频
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* 主工作区 */}
      <div className="workspace">
        {/* 侧边栏 */}
        <div className="sidebar">
          {/* Tab 切换 */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'scenes', icon: '🎞️', label: '场景' },
              { id: 'captions', icon: '💬', label: '字幕' },
              { id: 'export', icon: '📤', label: '导出' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`btn btn-sm ${activeTab === tab.id ? 'active' : ''}`}
                style={{
                  flex: 1,
                  borderRadius: 0,
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* 场景面板 */}
          {activeTab === 'scenes' && (
            <ScenePanel
              scenes={scenes}
              selectedSceneId={selectedSceneId}
              onSceneSelect={handleSceneSelect}
              detection={sceneDetection}
              onDetect={runSceneDetection}
              onDeleteScene={(id) => setScenes((prev) => prev.filter((s) => s.id !== id))}
            />
          )}

          {/* 字幕面板 */}
          {activeTab === 'captions' && (
            <CaptionPanel
              captions={captions}
              selectedCaptionId={selectedCaptionId}
              onCaptionSelect={handleCaptionSelect}
              generation={captionGen}
              onGenerate={runAutoCaptions}
              asrModel={asrModel}
              setAsrModel={setAsrModel}
              asrLanguage={asrLanguage}
              setAsrLanguage={setAsrLanguage}
              onUpdateCaption={(id, text) => {
                setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
              }}
              onDeleteCaption={(id) => setCaptions((prev) => prev.filter((c) => c.id !== id))}
            />
          )}

          {/* 导出面板 */}
          {activeTab === 'export' && (
            <ExportPanel
              scenes={scenes}
              captions={captions}
              exporting={exporting}
              onExport={handleExport}
              duration={duration}
            />
          )}
        </div>

        {/* 预览区 */}
        <div className="main-area">
          <div className="preview-container" onClick={togglePlay}>
            <video
              ref={videoRef}
              src={videoUrl}
              style={{ cursor: 'pointer' }}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            {/* 字幕覆盖层 */}
            {captions.length > 0 && (
              <div style={{
                position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
                textAlign: 'center', pointerEvents: 'none', maxWidth: '80%',
              }}>
                {captions
                  .filter((c) => currentTime >= c.start && currentTime <= c.end)
                  .map((c) => (
                    <div key={c.id} style={{
                      background: 'rgba(0,0,0,0.75)', color: 'white',
                      padding: '6px 16px', borderRadius: 6, fontSize: 16,
                      display: 'inline-block', marginBottom: 4,
                      backdropFilter: 'blur(4px)',
                    }}>
                      {c.text}
                    </div>
                  ))
                }
              </div>
            )}
            <div className="preview-overlay">
              <button className="btn-icon" style={{ color: 'white', fontSize: 16 }} onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span className="preview-time">
                {formatTimeShort(currentTime)} / {formatTimeShort(duration)}
              </span>
            </div>
          </div>

          {/* 时间线 */}
          <Timeline
            tracks={tracks}
            duration={duration}
            currentTime={currentTime}
            onSeek={seekTo}
            selectedSceneId={selectedSceneId}
            selectedCaptionId={selectedCaptionId}
          />
        </div>
      </div>

      {/* Toast */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}
