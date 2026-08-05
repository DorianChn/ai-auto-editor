import React from 'react';
import { formatTimeShort } from '../lib/timeline.js';

export default function CaptionPanel({
  captions, selectedCaptionId, onCaptionSelect, generation,
  onGenerate, asrModel, setAsrModel, asrLanguage, setAsrLanguage,
  onUpdateCaption, onDeleteCaption,
}) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 配置 */}
      <div className="sidebar-section">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              模型大小
            </label>
            <select
              value={asrModel}
              onChange={(e) => setAsrModel(e.target.value)}
              style={{
                width: '100%', padding: '4px 8px', borderRadius: 4,
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', fontSize: 12,
              }}
            >
              <option value="tiny">Tiny (最快)</option>
              <option value="base">Base (平衡)</option>
              <option value="small">Small (最准)</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              语言
            </label>
            <select
              value={asrLanguage}
              onChange={(e) => setAsrLanguage(e.target.value)}
              style={{
                width: '100%', padding: '4px 8px', borderRadius: 4,
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', fontSize: 12,
              }}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </div>
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={onGenerate}
          disabled={generation.status === 'running'}
        >
          {generation.status === 'running' ? '⏳ 生成中...' : '💬 一键生成字幕'}
        </button>
        {generation.status === 'running' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {generation.phase}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${generation.progress}%` }} />
            </div>
          </div>
        )}
        {generation.status === 'done' && (
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 6 }}>
            ✅ {generation.phase}
          </div>
        )}
        {generation.status === 'error' && (
          <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>
            ❌ {generation.phase}
          </div>
        )}
      </div>

      {/* 算法说明 */}
      <div className="sidebar-section" style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <strong>技术栈：</strong><br/>
          Whisper WASM (HuggingFace Transformers)<br/>
          浏览器端运行 · 无需API · 零费用
        </div>
      </div>

      {/* 字幕列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
        {!captions.length ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>
            {generation.status === 'idle' ? '点击上方按钮生成字幕' : '暂无字幕'}
          </div>
        ) : (
          <div className="caption-list">
            {captions.map((cap) => (
              <div
                key={cap.id}
                className={`caption-item ${cap.id === selectedCaptionId ? 'selected' : ''}`}
                onClick={() => onCaptionSelect(cap)}
              >
                <div className="caption-time">
                  {formatTimeShort(cap.start)}
                </div>
                <input
                  className="caption-text"
                  value={cap.text}
                  onChange={(e) => onUpdateCaption(cap.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--text-primary)',
                    fontSize: 12, flex: 1, outline: 'none', padding: 0,
                  }}
                />
                <button
                  className="btn-icon"
                  style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); onDeleteCaption(cap.id); }}
                  title="删除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 统计 */}
      {captions.length > 0 && (
        <div style={{
          padding: '8px 12px', borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{captions.length} 条字幕</span>
          <span>
            {formatTimeShort(captions[0]?.start || 0)} → {formatTimeShort(captions[captions.length - 1]?.end || 0)}
          </span>
        </div>
      )}
    </div>
  );
}
