import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimestamp,
  validateSplitPointInputs,
  buildVerticalSegments,
  buildSegmentTitle,
  buildSegmentFilename,
  normalizeProjectSplitConfig
} from '../shared/verticalSegments.js';

test('parses MM:SS and HH:MM:SS', () => {
  assert.deepEqual(parseTimestamp('02:00'), { ok: true, seconds: 120 });
  assert.deepEqual(parseTimestamp('01:02:03'), { ok: true, seconds: 3723 });
  assert.equal(parseTimestamp('02:60').ok, false);
});

test('validates, sorts, and rejects duplicate markers', () => {
  assert.deepEqual(validateSplitPointInputs(['03:00', '02:00'], 300), {
    valid: true,
    splitPoints: [120, 180],
    errors: [null, null]
  });
  assert.equal(validateSplitPointInputs(['02:00', '02:00'], 300).valid, false);
});

test('builds overlapping segments', () => {
  assert.deepEqual(buildVerticalSegments(300, [120, 180], 5), [
    { index: 1, startTime: 0, endTime: 120, duration: 120 },
    { index: 2, startTime: 115, endTime: 180, duration: 65 },
    { index: 3, startTime: 175, endTime: 300, duration: 125 }
  ]);
  assert.equal(buildVerticalSegments(20, [3], 5)[1].startTime, 0);
});

test('numbers titles and files', () => {
  assert.equal(buildSegmentTitle('Title', 2), 'Title (2)');
  assert.equal(buildSegmentTitle('', 2), '');
  assert.equal(buildSegmentFilename('video.mp4', 2), 'video_vertical_2.mp4');
});

test('normalizes old project split defaults', () => {
  assert.deepEqual(normalizeProjectSplitConfig({}), {
    enabled: false,
    splitPoints: [],
    overlapSeconds: 5
  });
});
