import React from 'react';
import { formatTimeShort } from '../lib/timeline.js';

export default function ExportPanel({ scenes, captions, exporting, onExport, duration }) {
  const options = [
    {
      id: 'clips',
      icon: '🎞️',
      title: '导出剪辑片段',
      desc: `合并 ${scenes.length} 个场景为一个视频`,
      disabled: !scenes.length,
    },
    {
      id: 'subtitles',
      icon: '📝',
      title: '导出字幕文件',
      desc: `导出 ${captions.length} 条字幕为 SRT 文件`,
      disabled: !captions.length,
    },
    {
      id: 'burned',
      icon: '🔥',
      title: '烧录字幕到视频',
      desc: '将字幕硬编码到视频画面中',
      disabled: !captions.length,
    },
  ];

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* 项目摘要 */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">项目信息</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>⏱ 时长: {formatTimeShort(duration)}</div>
          <div>🎞️ 场景: {scenes.length} 个</div>
          <div>💬 字幕: {captions.length} 条</div>
        </div>
      </div>

      {/* 导出选项 */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">导出选项</div>
        <div className="export-panel" style={{ padding: 0 }}>
          {options.map((opt) => (
            <div
              key={opt.id}
              className="export-option"
              style={{ opacity: opt.disabled ? 0.4 : 1, cursor: opt.disabled ? 'not-allowed' : 'pointer' }}
              onClick={() => !opt.disabled && exporting.status !== 'running' && onExport(opt.id)}
            >
              <div className="export-option-icon">{opt.icon}</div>
              <div className="export-option-info">
                <div className="export-option-title">{opt.title}</div>
                <div className="export-option-desc">{opt.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 导出进度 */}
      {exporting.status === 'running' && (
        <div className="sidebar-section">
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {exporting.phase}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${exporting.progress}%` }} />
          </div>
        </div>
      )}

      {exporting.status === 'done' && (
        <div className="sidebar-section">
          <div style={{ fontSize: 12, color: 'var(--success)', textAlign: 'center' }}>
            ✅ 导出完成！文件已自动下载
          </div>
        </div>
      )}

      {/* 提示 */}
      <div className="sidebar-section" style={{ padding: '12px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          <strong>💡 提示</strong><br/>
          • 所有处理在浏览器本地完成<br/>
          • 导出使用 FFmpeg WASM<br/>
          • 大文件可能需要较长时间<br/>
          • 建议使用 Chrome 浏览器
        </div>
      </div>
    </div>
  );
}
