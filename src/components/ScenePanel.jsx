import React from 'react';
import { formatTimeShort } from '../lib/timeline.js';

export default function ScenePanel({ scenes, selectedSceneId, onSceneSelect, detection, onDetect, onDeleteScene }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 检测控制 */}
      <div className="sidebar-section">
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={onDetect}
          disabled={detection.status === 'running'}
        >
          {detection.status === 'running' ? '⏳ 检测中...' : '🔍 一键场景检测'}
        </button>
        {detection.status === 'running' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {detection.phase}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${detection.progress}%` }} />
            </div>
          </div>
        )}
        {detection.status === 'done' && (
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 6 }}>
            ✅ {detection.phase}
          </div>
        )}
        {detection.status === 'error' && (
          <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>
            ❌ {detection.phase}
          </div>
        )}
      </div>

      {/* 算法说明 */}
      <div className="sidebar-section" style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <strong>算法流程：</strong><br/>
          ① 按3fps提取关键帧<br/>
          ② 帧间MAD计算差异分数<br/>
          ③ 自适应阈值（中位数+MAD）<br/>
          ④ 局部峰值过滤场景切换点<br/>
          ⑤ 合并过短场景
        </div>
      </div>

      {/* 场景列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
        {!scenes.length ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>
            {detection.status === 'idle' ? '点击上方按钮开始检测' : '暂无场景'}
          </div>
        ) : (
          <div className="scene-list">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className={`scene-item ${scene.id === selectedSceneId ? 'selected' : ''}`}
                onClick={() => onSceneSelect(scene)}
              >
                {scene.keyFrame?.thumb ? (
                  <img src={scene.keyFrame.thumb} className="scene-thumb" alt="" />
                ) : (
                  <div className="scene-thumb" />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 12 }}>场景 {scene.index + 1}</div>
                  <div className="scene-time">
                    {formatTimeShort(scene.start)} → {formatTimeShort(scene.end)} ({scene.duration.toFixed(1)}s)
                  </div>
                </div>
                <button
                  className="btn-icon"
                  style={{ fontSize: 12, color: 'var(--text-dim)' }}
                  onClick={(e) => { e.stopPropagation(); onDeleteScene(scene.id); }}
                  title="删除场景"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 统计 */}
      {scenes.length > 0 && (
        <div style={{
          padding: '8px 12px', borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{scenes.length} 个场景</span>
          <span>平均 {scenes.reduce((a, s) => a + s.duration, 0).toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
}
