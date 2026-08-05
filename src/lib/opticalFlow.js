/**
 * 光流追踪引擎 — 基于块匹配的简化光流
 * 用于在场景内进行更细粒度的动态分割
 */

/** 计算两个图像块之间的SAD（绝对差之和） */
function blockSAD(prev, curr, x, y, bx, by, blockSize, w) {
  let sad = 0;
  for (let dy = 0; dy < blockSize; dy++) {
    for (let dx = 0; dx < blockSize; dx++) {
      const pi = ((y + dy) * w + (x + dx)) * 4;
      const ci = ((by + dy) * w + (bx + dx)) * 4;
      sad += Math.abs(prev[pi] - curr[ci])
        + Math.abs(prev[pi + 1] - curr[ci + 1])
        + Math.abs(prev[pi + 2] - curr[ci + 2]);
    }
  }
  return sad;
}

/** 在搜索窗口内找到最佳匹配位置 */
function findBestMatch(prev, curr, x, y, w, h, blockSize, searchRange) {
  let bestSad = Infinity;
  let bestDx = 0;
  let bestDy = 0;

  const minDx = Math.max(-searchRange, -x);
  const maxDx = Math.min(searchRange, w - blockSize - x);
  const minDy = Math.max(-searchRange, -y);
  const maxDy = Math.min(searchRange, h - blockSize - y);

  for (let dy = minDy; dy <= maxDy; dy++) {
    for (let dx = minDx; dx <= maxDx; dx++) {
      const sad = blockSAD(prev, curr, x, y, x + dx, y + dy, blockSize, w);
      if (sad < bestSad) {
        bestSad = sad;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  return { dx: bestDx, dy: bestDy, sad: bestSad };
}

/** 计算两帧之间的光流向量场 */
export function computeOpticalFlow(prevData, currData, w, h, { blockSize = 16, searchRange = 16 } = {}) {
  const vectors = [];
  const cols = Math.floor(w / blockSize);
  const rows = Math.floor(h / blockSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * blockSize;
      const y = row * blockSize;
      const { dx, dy, sad } = findBestMatch(prevData, currData, x, y, w, h, blockSize, searchRange);
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      vectors.push({ x, y, dx, dy, magnitude, sad });
    }
  }

  return vectors;
}

/** 从光流向量场提取运动特征 */
export function extractMotionFeatures(vectors) {
  if (!vectors.length) return { avgMagnitude: 0, maxMagnitude: 0, direction: 0, coherence: 0 };

  const magnitudes = vectors.map((v) => v.magnitude);
  const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const maxMagnitude = Math.max(...magnitudes);

  // 运动方向一致性（向量点积平均值）
  let sumDx = 0;
  let sumDy = 0;
  for (const v of vectors) {
    if (v.magnitude > 0.5) {
      sumDx += v.dx / v.magnitude;
      sumDy += v.dy / v.magnitude;
    }
  }
  const activeVectors = vectors.filter((v) => v.magnitude > 0.5).length || 1;
  const coherence = Math.sqrt(sumDx ** 2 + sumDy ** 2) / activeVectors;
  const direction = Math.atan2(sumDy, sumDx);

  return { avgMagnitude, maxMagnitude, direction, coherence };
}

/** 从视频中提取用于光流分析的灰度帧数据 */
export async function extractGrayFrames(videoEl, times, size = 160) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = size;
  const h = Math.round((videoEl.videoHeight / videoEl.videoWidth) * size);
  canvas.width = w;
  canvas.height = h;

  const frames = [];
  for (const time of times) {
    videoEl.currentTime = time;
    await new Promise((resolve) => {
      if (videoEl.seeking) {
        videoEl.addEventListener('seeked', resolve, { once: true });
      } else {
        resolve();
      }
    });
    ctx.drawImage(videoEl, 0, 0, w, h);
    frames.push({ time, data: ctx.getImageData(0, 0, w, h).data, w, h });
  }

  return frames;
}

/** 基于光流检测场景内的动态时间点 */
export async function detectMotionCuts(videoEl, scene, { sampleRate = 4, size = 80 } = {}) {
  const duration = scene.end - scene.start;
  if (duration < 1) return [];

  const interval = 1 / sampleRate;
  const times = [];
  for (let t = scene.start; t < scene.end; t += interval) {
    times.push(t);
  }

  const frames = await extractGrayFrames(videoEl, times, size);
  const motionScores = [];

  for (let i = 1; i < frames.length; i++) {
    const vectors = computeOpticalFlow(frames[i - 1].data, frames[i].data, frames[i].w, frames[i].h, {
      blockSize: 8,
      searchRange: 8,
    });
    const features = extractMotionFeatures(vectors);
    motionScores.push({
      time: frames[i].time,
      ...features,
    });
  }

  return motionScores;
}
