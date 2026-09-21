import assert from 'node:assert/strict';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

const createdUrls = [];
const revokedUrls = [];
globalThis.URL = {
  createObjectURL(value) {
    const url = `blob:test-${createdUrls.length + 1}`;
    createdUrls.push({ url, value });
    return url;
  },
  revokeObjectURL(url) {
    revokedUrls.push(url);
  },
};

const videos = [];
globalThis.document = {
  createElement(type) {
    assert.equal(type, 'video');
    const video = new FakeEventTarget();
    videos.push(video);
    return video;
  },
};

const audios = [];
class FakeAudio extends FakeEventTarget {
  constructor(url) {
    super();
    this.url = url;
    this.paused = false;
    audios.push(this);
  }

  pause() {
    this.paused = true;
  }

  play() {
    return Promise.resolve();
  }
}
globalThis.Audio = FakeAudio;

const recognitions = [];
class FakeRecognition {
  constructor() {
    recognitions.push(this);
  }

  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
    this.onend?.();
  }
}
globalThis.window = {
  SpeechRecognition: FakeRecognition,
  webkitSpeechRecognition: undefined,
};

const { transcribeWithBrowserAPI, videoToAudioBlob } = await import('../src/lib/asr.js');

const videoFile = { name: 'demo.mp4' };
const loadedVideo = videoToAudioBlob(videoFile);
videos[0].emit('loadeddata');
assert.equal(await loadedVideo, videoFile);
assert.deepEqual(revokedUrls, ['blob:test-1']);
assert.equal(videos[0].listenerCount('loadeddata'), 0);
assert.equal(videos[0].listenerCount('error'), 0);

const failedVideo = videoToAudioBlob(videoFile);
videos[1].emit('error');
assert.equal(await failedVideo, videoFile);
assert.deepEqual(revokedUrls, ['blob:test-1', 'blob:test-2']);

const successfulTranscription = transcribeWithBrowserAPI({ name: 'audio.wav' });
recognitions[0].onend();
assert.deepEqual(await successfulTranscription, { segments: [], language: 'zh-CN' });
assert.equal(revokedUrls[2], 'blob:test-3');
assert.equal(audios[0].paused, true);
assert.equal(audios[0].listenerCount('ended'), 0);

const failedTranscription = transcribeWithBrowserAPI({ name: 'blocked.wav' });
recognitions[1].onerror({ error: 'not-allowed' });
await assert.rejects(failedTranscription, /not-allowed/);
assert.equal(revokedUrls[3], 'blob:test-4');
assert.equal(audios[1].listenerCount('ended'), 0);

console.log('ASR resource cleanup tests passed');
