import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSrtCues, sliceAndRebaseCues } from '../electron/verticalSubtitles.js';

const content = `1
00:01:50,000 --> 00:01:58,000
Before and overlap

2
00:01:59,000 --> 00:02:05,000
Across boundary

3
00:03:01,000 --> 00:03:02,000
After`;

test('keeps intersecting cues and rebases them to segment zero', () => {
  const cues = sliceAndRebaseCues(parseSrtCues(content), 115, 180);
  assert.deepEqual(cues, [
    { start: 0, end: 3, text: 'Before and overlap' },
    { start: 4, end: 10, text: 'Across boundary' }
  ]);
});
