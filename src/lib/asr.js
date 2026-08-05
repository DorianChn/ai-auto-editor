/**
 * 语音识别模块 — 使用 @huggingface/transformers 的 Whisper WASM
 * 完全在浏览器端运行，无需后端API
 */

let pipeline = null;
let currentModel = null;

/** 获取或加载 Whisper pipeline */
async function getWhisperPipeline(modelName = 'Xenova/whisper-tiny', progressCallback) {
  if (pipeline && currentModel === modelName) return pipeline;

  // 动态导入避免首次加载开销
  const { pipeline: loadPipeline, env } = await import('@huggingface/transformers');

  // 配置 WASM 后端
  env.backends.onnx.wasm.proxy = false;

  progressCallback?.({ phase: '加载Whisper模型...', progress: 10 });

  pipeline = await loadPipeline('automatic-speech-recognition', modelName, {
    progress_callback: (info) => {
      if (info.status === 'progress' && progressCallback) {
        progressCallback({
          phase: `下载模型 ${Math.round(info.progress)}%`,
          progress: 10 + Math.round(info.progress * 0.7),
        });
      }
      if (info.status === 'done' && progressCallback) {
        progressCallback({ phase: '模型加载完成', progress: 80 });
      }
    },
  });

  currentModel = modelName;
  return pipeline;
}

/** 从视频/音频 blob 提取音频数据 */
export async function extractAudioFromBlob(blob) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // 转换为单声道 16kHz Float32Array（Whisper 要求）
  const rawData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // 如果采样率不是 16kHz，需要重采样
  if (sampleRate !== 16000) {
    const ratio = sampleRate / 16000;
    const newLength = Math.round(rawData.length / ratio);
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const low = Math.floor(srcIndex);
      const high = Math.min(low + 1, rawData.length - 1);
      const frac = srcIndex - low;
      resampled[i] = rawData[low] * (1 - frac) + rawData[high] * frac;
    }
    audioCtx.close();
    return { data: resampled, sampleRate: 16000, duration: audioBuffer.duration };
  }

  audioCtx.close();
  return { data: rawData, sampleRate, duration: audioBuffer.duration };
}

/** 将视频文件转为音频 blob */
export async function videoToAudioBlob(videoFile) {
  return new Promise((resolve, reject) => {
    // 直接用文件本身，后续通过 AudioContext 解码
    // 对于大多数浏览器，Video 元素也能解码音频
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.muted = false;
    video.preload = 'auto';

    video.addEventListener('loadeddata', () => {
      // 使用 MediaRecorder 捕获音频
      // 简化方案：直接返回文件blob让 extractAudioFromBlob 处理
      resolve(videoFile);
    });

    video.addEventListener('error', () => {
      // 回退：直接使用原文件
      resolve(videoFile);
    });

    setTimeout(() => resolve(videoFile), 3000);
  });
}

/** 转录音频为带时间戳的字幕片段 */
export async function transcribeAudio(audioBlob, { language = 'zh', onProgress, modelSize = 'tiny' } = {}) {
  const modelMap = {
    tiny: 'Xenova/whisper-tiny',
    base: 'Xenova/whisper-base',
    small: 'Xenova/whisper-small',
  };
  const modelName = modelMap[modelSize] || modelMap.tiny;

  onProgress?.({ phase: '准备音频...', progress: 5 });

  // 提取音频数据
  const { data, duration } = await extractAudioFromBlob(audioBlob);
  onProgress?.({ phase: '加载AI模型...', progress: 10 });

  // 加载 Whisper
  const whisper = await getWhisperPipeline(modelName, (info) => {
    onProgress?.({ phase: info.phase, progress: info.progress });
  });

  onProgress?.({ phase: '正在转写...', progress: 85 });

  // 执行转写
  const result = await whisper(data, {
    language: language === 'zh' ? 'chinese' : language,
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  onProgress?.({ phase: '转写完成', progress: 100 });

  // 解析结果为字幕片段
  const segments = [];
  if (result?.chunks) {
    for (const chunk of result.chunks) {
      const text = chunk.text?.trim();
      if (text) {
        segments.push({
          id: `cap-${segments.length}`,
          start: chunk.timestamp?.[0] ?? 0,
          end: chunk.timestamp?.[1] ?? chunk.timestamp?.[0] + 1 ?? 0,
          text,
        });
      }
    }
  } else if (result?.text) {
    // 无时间戳时均匀分配
    const words = result.text.trim().split(/[，。！？、；：\s]+/).filter(Boolean);
    const segDuration = duration / words.length;
    words.forEach((word, i) => {
      segments.push({
        id: `cap-${i}`,
        start: i * segDuration,
        end: (i + 1) * segDuration,
        text: word,
      });
    });
  }

  return { segments, duration, language };
}

/** 使用浏览器原生 SpeechRecognition API（无需模型下载的备选方案） */
export function transcribeWithBrowserAPI(audioBlob, { language = 'zh-CN', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reject(new Error('浏览器不支持语音识别'));
      return;
    }

    onProgress?.({ phase: '使用浏览器语音识别...', progress: 10 });

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = false;

    const segments = [];
    let index = 0;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const result = event.results[i];
          segments.push({
            id: `cap-${index++}`,
            start: result[0].timestamp / 1000 || index * 2,
            end: (result[0].timestamp + result[0].duration) / 1000 || (index + 1) * 2,
            text: result[0].transcript.trim(),
          });
        }
      }
      onProgress?.({ phase: `已识别 ${segments.length} 条字幕`, progress: 50 + Math.min(40, segments.length * 2) });
    };

    recognition.onend = () => {
      onProgress?.({ phase: '识别完成', progress: 100 });
      resolve({ segments, language });
    };

    recognition.onerror = (e) => {
      reject(new Error(`语音识别错误: ${e.error}`));
    };

    // 创建音频URL播放给识别引擎
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.addEventListener('ended', () => {
      setTimeout(() => recognition.stop(), 1000);
    });

    recognition.start();
    audio.play().catch(() => {
      // 如果自动播放被阻止，仍尝试识别
      setTimeout(() => recognition.stop(), 5000);
    });
  });
}
