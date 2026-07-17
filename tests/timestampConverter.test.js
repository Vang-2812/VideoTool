import test from 'node:test';
import assert from 'node:assert/strict';
import { srtToTimestampText } from '../shared/timestampConverter.js';

test('srtToTimestampText converts standard SRT cues to [mm:ss] format', () => {
  const srt = `1
00:01:15,000 --> 00:01:20,000
The river is gone.

2
00:02:05,500 --> 00:02:10,000
The mud is cracking!`;

  const result = srtToTimestampText(srt);
  const lines = result.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '[01:15] The river is gone.');
  assert.equal(lines[1], '[02:05] The mud is cracking!');
});

test('srtToTimestampText converts long video SRT cues to [hh:mm:ss] format', () => {
  const srt = `1
01:15:22,100 --> 01:15:30,000
Over an hour scene.`;

  const result = srtToTimestampText(srt);
  assert.equal(result.trim(), '[01:15:22] Over an hour scene.');
});
