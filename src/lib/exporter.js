/**
 * 视频导出模块 — 使用 FFmpeg WASM 进行浏览器端视频处理
 */

let ffmpegInstance = null;
let ffmpegLoaded = false;

async function getFFmpeg() {
  if (ffmpegInstance && ffmpegLoaded) return ffmpegInstance;

  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');

  const ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  ffmpegLoaded = true;
  return ffmpeg;
}

/** 从视频文件中提取音频 */
export async function extractAudio(videoFile) {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
  await ffmpeg.exec(['-i', 'input.mp4', '-vn', '-acodec', 'aac', '-y', 'audio.aac']);
  const data = await ffmpeg.readFile('audio.aac');
  return new Blob([data.buffer], { type: 'audio/aac' });
}

/** 合并视频片段 */
export async function mergeClips(videoFile, clips, { onProgress } = {}) {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  onProgress?.({ phase: '准备导出...', progress: 5 });

  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

  // 构建 FFmpeg 复杂滤镜图 — 选择片段并拼接
  if (clips.length === 1) {
    // 单片段裁剪
    const clip = clips[0];
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-ss', String(clip.start),
      '-to', String(clip.end),
      '-c:v', 'libx264', '-c:a', 'aac',
      '-y', 'output.mp4',
    ]);
  } else {
    // 多片段拼接 — 使用 concat demuxer
    let concatContent = '';
    for (const clip of clips) {
      concatContent += `file 'input.mp4'\n`;
      concatContent += `inpoint ${clip.start}\n`;
      concatContent += `outpoint ${clip.end}\n`;
    }
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatContent));

    onProgress?.({ phase: '正在拼接片段...', progress: 30 });

    await ffmpeg.exec([
      '-f', 'concat', '-safe', '0',
      '-i', 'concat.txt',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-y', 'output.mp4',
    ]);
  }

  onProgress?.({ phase: '导出完成', progress: 100 });

  const data = await ffmpeg.readFile('output.mp4');
  return new Blob([data.buffer], { type: 'video/mp4' });
}

/** 为视频添加字幕（烧录字幕） */
export async function burnSubtitles(videoFile, captions, { onProgress } = {}) {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  onProgress?.({ phase: '准备字幕...', progress: 10 });

  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

  // 生成 SRT 文件
  let srt = '';
  captions.forEach((cap, i) => {
    const startH = Math.floor(cap.start / 3600);
    const startM = Math.floor((cap.start % 3600) / 60);
    const startS = Math.floor(cap.start % 60);
    const startMs = Math.floor((cap.start % 1) * 1000);
    const endH = Math.floor(cap.end / 3600);
    const endM = Math.floor((cap.end % 3600) / 60);
    const endS = Math.floor(cap.end % 60);
    const endMs = Math.floor((cap.end % 1) * 1000);

    srt += `${i + 1}\n`;
    srt += `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:${String(startS).padStart(2, '0')},${String(startMs).padStart(3, '0')}`;
    srt += ` --> `;
    srt += `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:${String(endS).padStart(2, '0')},${String(endMs).padStart(3, '0')}\n`;
    srt += `${cap.text}\n\n`;
  });

  await ffmpeg.writeFile('subtitles.srt', new TextEncoder().encode(srt));

  onProgress?.({ phase: '正在烧录字幕...', progress: 30 });

  // 使用 subtitles 滤镜烧录字幕
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', "subtitles=subtitles.srt:force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=30'",
    '-c:v', 'libx264', '-c:a', 'aac',
    '-y', 'output.mp4',
  ]);

  onProgress?.({ phase: '导出完成', progress: 100 });

  const data = await ffmpeg.readFile('output.mp4');
  return new Blob([data.buffer], { type: 'video/mp4' });
}

/** 下载 blob 为文件 */
export function downloadBlob(blob, filename = 'output.mp4') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导出字幕为 SRT 文件 */
export function exportSubtitlesSRT(captions) {
  let srt = '';
  captions.forEach((cap, i) => {
    const formatTs = (s) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      const ms = Math.floor((s % 1) * 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };
    srt += `${i + 1}\n${formatTs(cap.start)} --> ${formatTs(cap.end)}\n${cap.text}\n\n`;
  });

  const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, 'subtitles.srt');
}
