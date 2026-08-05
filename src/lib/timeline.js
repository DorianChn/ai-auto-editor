/**
 * 时间线管理 — 片段、轨道、播放控制
 */

let _idCounter = 0;
export function makeId(prefix = 'seg') {
  return `${prefix}-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}

/** 格式化时间为 HH:MM:SS.mmm */
export function formatTime(seconds) {
  if (!seconds && seconds !== 0) return '00:00.000';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const parts = [m.toString().padStart(2, '0'), s.toString().padStart(2, '0')];
  if (h > 0) parts.unshift(h.toString().padStart(2, '0'));
  return parts.join(':') + '.' + ms.toString().padStart(3, '0');
}

/** 格式化为简短时间 MM:SS */
export function formatTimeShort(seconds) {
  if (!seconds && seconds !== 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 从场景列表构建时间线项目 */
export function buildTimelineFromScenes(scenes) {
  return scenes.map((scene) => ({
    id: makeId('visual'),
    type: 'video',
    start: scene.start,
    end: scene.end,
    duration: scene.duration,
    sceneId: scene.id,
    label: `场景 ${scene.index + 1}`,
    keyFrame: scene.keyFrame,
  }));
}

/** 从字幕列表构建字幕轨道项目 */
export function buildCaptionTrack(segments) {
  return segments.map((seg) => ({
    id: seg.id || makeId('cap'),
    type: 'caption',
    start: seg.start,
    end: seg.end,
    duration: seg.end - seg.start,
    text: seg.text,
  }));
}

/** 删除片段并重新排列 */
export function removeSegment(segments, segmentId) {
  const filtered = segments.filter((s) => s.id !== segmentId);
  return filtered.map((s, i) => ({ ...s, index: i }));
}

/** 裁剪片段 */
export function trimSegment(segment, newStart, newEnd) {
  return {
    ...segment,
    start: Math.max(0, newStart),
    end: Math.min(segment.end, newEnd),
    duration: newEnd - newStart,
  };
}

/** 分割片段 */
export function splitSegment(segment, splitTime) {
  if (splitTime <= segment.start || splitTime >= segment.end) return [segment];
  return [
    { ...segment, id: makeId('seg'), end: splitTime, duration: splitTime - segment.start },
    { ...segment, id: makeId('seg'), start: splitTime, duration: segment.end - splitTime },
  ];
}

/** 计算时间线总时长 */
export function getTotalDuration(tracks) {
  let max = 0;
  for (const track of Object.values(tracks)) {
    for (const item of track) {
      max = Math.max(max, item.end || 0);
    }
  }
  return max;
}
