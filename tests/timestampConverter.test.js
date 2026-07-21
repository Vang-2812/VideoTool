import test from 'node:test';
import assert from 'node:assert/strict';
import { srtToTimestampText, mapScriptToSrtTimestamps } from '../shared/timestampConverter.js';

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

test('mapScriptToSrtTimestamps maps script paragraphs to SRT word timestamps without ms (rounding >=500ms)', () => {
  const script = "Okay, so you want to own a casino.\n\nYou picture the front doors opening,";
  const srt = `1\n00:00:00,120 --> 00:00:00,450\nOkay,\n\n2\n00:00:00,460 --> 00:00:00,600\nso\n\n3\n00:00:02,600 --> 00:00:02,900\nYou\n\n4\n00:00:02,950 --> 00:00:03,100\npicture\n\n5\n00:00:03,150 --> 00:00:03,300\nthe`;

  const result = mapScriptToSrtTimestamps(script, srt, { includeMs: false });
  assert.equal(result, "[00:00] Okay, so you want to own a casino.\n\n[00:03] You picture the front doors opening,");
});

test('mapScriptToSrtTimestamps maps script paragraphs to SRT word timestamps with ms', () => {
  const script = "Okay, so you want to own a casino.\n\nYou picture the front doors opening,";
  const srt = `1\n00:00:00,120 --> 00:00:00,450\nOkay,\n\n2\n00:00:00,460 --> 00:00:00,600\nso\n\n3\n00:00:02,234 --> 00:00:02,900\nYou\n\n4\n00:00:02,950 --> 00:00:03,100\npicture\n\n5\n00:00:03,150 --> 00:00:03,300\nthe`;

  const result = mapScriptToSrtTimestamps(script, srt, { includeMs: true });
  assert.equal(result, "[00:00:120] Okay, so you want to own a casino.\n\n[00:02:234] You picture the front doors opening,");
});

