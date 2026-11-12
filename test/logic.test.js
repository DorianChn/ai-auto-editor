import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeShortScenes } from '../src/lib/sceneDetector.js';
import { trimSegment } from '../src/lib/timeline.js';

function scene(start, end, index) {
  return {
    id: `scene-${index}`,
    index,
    start,
    end,
    duration: end - start,
    frames: [{ index }],
  };
}

test('mergeShortScenes merges a short final scene', () => {
  const merged = mergeShortScenes([scene(0, 2, 0), scene(2, 2.25, 1)], 0.5);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].start, 0);
  assert.equal(merged[0].end, 2.25);
  assert.equal(merged[0].duration, 2.25);
  assert.deepEqual(merged[0].frames.map((frame) => frame.index), [0, 1]);
});

test('trimSegment clamps bounds and keeps duration consistent', () => {
  const segment = { id: 's1', start: 2, end: 8, duration: 6 };

  assert.deepEqual(trimSegment(segment, 0, 20), {
    ...segment,
    start: 2,
    end: 8,
    duration: 6,
  });
  assert.deepEqual(trimSegment(segment, 6, 3), {
    ...segment,
    start: 6,
    end: 6,
    duration: 0,
  });
});
