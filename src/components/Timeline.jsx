import React, { useRef, useCallback } from 'react';
import { formatTimeShort } from '../lib/timeline.js';

export default function Timeline({ tracks, duration, currentTime, onSeek, selectedSceneId, selectedCaptionId }) {
  const trackRef = useRef(null);

  const handleClick = useCallback((e) => {
    if (!trackRef.current || !duration) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  const playheadPos = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="timeline-container">
      <div className="timeline-toolbar">
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>⏱ {formatTimeShort(currentTime)}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
          总时长 {formatTimeShort(duration)}
        </span>
      </div>
      <div className="timeline-tracks" ref={trackRef} onClick={handleClick}>
        {/* 播放头 */}
        <div className="timeline-playhead" style={{ left: `${playheadPos}%` }} />

        {/* 视频轨道 */}
        <div className="timeline-track">
          <div className="timeline-track-label">视频</div>
          <div className="timeline-track-content">
            {(tracks.visual || []).map((clip) => {
              const left = duration > 0 ? (clip.start / duration) * 100 : 0;
              const width = duration > 0 ? ((clip.end - clip.start) / duration) * 100 : 0;
              return (
                <div
                  key={clip.id}
                  className={`timeline-clip timeline-clip-visual ${clip.id === selectedSceneId ? 'selected' : ''}`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                  onClick={(e) => { e.stopPropagation(); onSeek(clip.start); }}
                >
                  {clip.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* 字幕轨道 */}
        <div className="timeline-track">
          <div className="timeline-track-label">字幕</div>
          <div className="timeline-track-content">
            {(tracks.caption || []).map((clip) => {
              const left = duration > 0 ? (clip.start / duration) * 100 : 0;
              const width = duration > 0 ? ((clip.end - clip.start) / duration) * 100 : 0;
              return (
                <div
                  key={clip.id}
                  className={`timeline-clip timeline-clip-caption ${clip.id === selectedCaptionId ? 'selected' : ''}`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }}
                  onClick={(e) => { e.stopPropagation(); onSeek(clip.start); }}
                  title={clip.text}
                >
                  {clip.text?.slice(0, 20)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
