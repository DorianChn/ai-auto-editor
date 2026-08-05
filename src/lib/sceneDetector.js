/**
 * 场景检测引擎 — 基于帧差分的自适应阈值场景分割
 * 改进自 MartinDelophy/ai-video-editor 的 autoEdit.js
 */

/** 从视频中按固定间隔提取帧并计算帧间差异 */
export async function extractFramesWithDiff(videoEl, { fps = 2, onProgress } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = 160; // 缩略图宽度，降低计算量
  const h = Math.round((videoEl.videoHeight / videoEl.videoWidth) * w);
  canvas.width = w;
  canvas.height = h;

  const duration = videoEl.duration;
  const interval = 1 / fps;
  const totalFrames = Math.floor(duration * fps);
  const frames = [];

  let prevData = null;

  for (let i = 0; i < totalFrames; i++) {
    const time = i * interval;
    videoEl.currentTime = time;
    await new Promise((resolve) => {
      if (videoEl.seeking) {
        videoEl.addEventListener('seeked', resolve, { once: true });
      } else {
        resolve();
      }
    });

    ctx.drawImage(videoEl, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // 计算帧间差异（像素级MAD）
    let diff = 0;
    if (prevData) {
      let sum = 0;
      for (let p = 0; p < data.length; p += 4) {
        sum += Math.abs(data[p] - prevData[p])
          + Math.abs(data[p + 1] - prevData[p + 1])
          + Math.abs(data[p + 2] - prevData[p + 2]);
      }
      diff = sum / (w * h * 3 * 255); // 归一化到 [0, 1]
    }

    // 计算帧质量（亮度方差作为清晰度指标）
    let brightnessSum = 0;
    for (let p = 0; p < data.length; p += 4) {
      brightnessSum += (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114);
    }
    const avgBrightness = brightnessSum / (w * h);
    let varianceSum = 0;
    for (let p = 0; p < data.length; p += 4) {
      const b = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
      varianceSum += (b - avgBrightness) ** 2;
    }
    const quality = Math.min(1, Math.sqrt(varianceSum / (w * h)) / 60);

    // 生成缩略图
    const thumb = canvas.toDataURL('image/jpeg', 0.5);

    frames.push({ time, diff, quality, thumb, index: i });
    prevData = data;

    if (onProgress) onProgress({ current: i + 1, total: totalFrames, phase: 'extracting' });
  }

  return frames;
}

/** 自适应阈值 — 基于中位数绝对偏差 */
export function getAdaptiveThreshold(frames, floor = 0.08) {
  const scores = frames.slice(1).map((f) => f.diff);
  if (!scores.length) return floor;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map((s) => Math.abs(s - median)).sort((a, b) => a - b);
  const medianMad = mad[Math.floor(mad.length / 2)];
  return Math.max(floor, median + Math.max(0.03, medianMad * 2.5));
}

/** 从帧序列中选出场景切换点 */
export function detectScenes(frames, { threshold, minGap = 1.0, maxScenes = 50 } = {}) {
  if (frames.length < 2) return [{ start: 0, end: frames[frames.length - 1]?.time || 0, frames }];

  const effectiveThreshold = threshold ?? getAdaptiveThreshold(frames);
  const changePoints = [];

  // 找出所有超过阈值的帧
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].diff >= effectiveThreshold && frames[i].quality >= 0.15) {
      // 确认是局部峰值（前后帧差异都小于当前帧）
      const prevDiff = frames[i - 1]?.diff || 0;
      const nextDiff = frames[i + 1]?.diff || 0;
      if (frames[i].diff >= prevDiff && frames[i].diff >= nextDiff * 0.8) {
        changePoints.push(frames[i]);
      }
    }
  }

  // 去重：相邻切换点间隔不小于 minGap
  const filtered = [];
  for (const point of changePoints) {
    if (!filtered.length || point.time - filtered[filtered.length - 1].time >= minGap) {
      filtered.push(point);
    }
    if (filtered.length >= maxScenes) break;
  }

  // 构建场景片段
  const scenes = [];
  const boundaries = [0, ...filtered.map((f) => f.time), frames[frames.length - 1].time];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const sceneFrames = frames.filter((f) => f.time >= start && f.time < end);
    const keyFrame = sceneFrames.reduce(
      (best, f) => (f.quality > (best?.quality || 0) ? f : best),
      sceneFrames[0]
    );
    scenes.push({
      id: `scene-${i}`,
      index: i,
      start,
      end,
      duration: end - start,
      keyFrame,
      frames: sceneFrames,
    });
  }

  return scenes;
}

/** 合并过短的场景 */
export function mergeShortScenes(scenes, minDuration = 0.5) {
  if (scenes.length <= 1) return scenes;
  const merged = [scenes[0]];
  for (let i = 1; i < scenes.length; i++) {
    const last = merged[merged.length - 1];
    if (last.duration < minDuration) {
      // 合并到前一个场景
      merged[merged.length - 1] = {
        ...last,
        end: scenes[i].end,
        duration: scenes[i].end - last.start,
        frames: [...last.frames, ...scenes[i].frames],
      };
    } else {
      merged.push(scenes[i]);
    }
  }
  // 重新编号
  return merged.map((s, i) => ({ ...s, index: i, id: `scene-${i}` }));
}
